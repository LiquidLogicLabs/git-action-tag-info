import * as https from 'https';
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import * as core from '@actions/core';
import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, ItemType, Platform } from '../types';
import { Logger } from '../logger';
import { tryGitLsRemoteFallback } from './git-fallback';

// Create Octokit with throttling plugin for automatic rate limit handling
const ThrottledOctokit = Octokit.plugin(throttling);

/**
 * Create an Octokit instance with optional authentication, certificate validation, and rate limit handling
 */
function createOctokit(
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): InstanceType<typeof ThrottledOctokit> {
  const options: ConstructorParameters<typeof ThrottledOctokit>[0] = {
    auth: token,
    baseUrl: baseUrl || 'https://api.github.com',
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        core.warning(
          `Rate limit exceeded for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds...`
        );
        // Retry up to 2 times
        if (retryCount < 2) {
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit) => {
        core.warning(
          `Secondary rate limit detected for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds...`
        );
        // Always retry secondary rate limits (abuse detection)
        return true;
      },
    },
  };

  // Handle certificate validation for GitHub Enterprise with self-signed certs
  if (ignoreCertErrors) {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    options.request = {
      agent,
    };
  }

  return new ThrottledOctokit(options);
}

/**
 * GitHub API client
 */
export class GitHubAPI implements PlatformAPI {
  private octokit: InstanceType<typeof ThrottledOctokit>;
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    const baseUrl = config.baseUrl || 'https://api.github.com';
    this.octokit = createOctokit(baseUrl, config.token, config.ignoreCertErrors);
    this.repoInfo = repoInfo;
    this.logger = logger;
  }

  /**
   * Get tag information
   */
  async getTagInfo(tagName: string): Promise<ItemInfo> {
    try {
      // Get the tag ref
      const { data: refData } = await this.octokit.git.getRef({
        owner: this.repoInfo.owner,
        repo: this.repoInfo.repo,
        ref: `tags/${tagName}`,
      });

      // Get the object SHA (could be tag or commit)
      const objectSha = refData.object.sha;
      const objectType = refData.object.type;

      // If it's a tag object, we need to fetch the tag object to get the commit
      let commitSha = objectSha;
      let tagMessage = '';
      let itemType = ItemType.COMMIT;
      let verified = false;

      if (objectType === 'tag') {
        // Fetch the tag object
        try {
          const { data: tagData } = await this.octokit.git.getTag({
            owner: this.repoInfo.owner,
            repo: this.repoInfo.repo,
            tag_sha: objectSha,
          });
          commitSha = tagData.object.sha;
          tagMessage = tagData.message || '';
          itemType = ItemType.TAG;
          verified = tagData.verification?.verified || false;
        } catch (error) {
          // If we can't get the tag object, use the ref data
          // This shouldn't happen, but handle gracefully
        }
      }

      return {
        exists: true,
        name: tagName,
        item_sha: objectSha,
        item_type: itemType,
        commit_sha: commitSha,
        details: tagMessage,
        verified,
        is_draft: false,
        is_prerelease: false,
      };
    } catch (error: unknown) {
      // Handle 404 errors (tag doesn't exist)
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        // Try fallback: check remote tags via git ls-remote if we have a repository URL
        const fallbackResult = tryGitLsRemoteFallback(tagName, this.repoInfo.url, this.logger);
        if (fallbackResult) {
          return fallbackResult;
        }

        return {
          exists: false,
          name: tagName,
          item_sha: '',
          item_type: ItemType.COMMIT,
          commit_sha: '',
          details: '',
          verified: false,
          is_draft: false,
          is_prerelease: false,
        };
      }

      // Re-throw other errors with formatted message
      if (error instanceof Error) {
        throw new Error(`Failed to get tag info from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get tag info from GitHub: ${String(error)}`);
    }
  }

  /**
   * Get release information
   */
  async getReleaseInfo(tagName: string): Promise<ItemInfo> {
    try {
      // Get release by tag name or latest if tagName is "latest"
      let releaseData;
      if (tagName.toLowerCase() === 'latest') {
        const { data } = await this.octokit.repos.getLatestRelease({
          owner: this.repoInfo.owner,
          repo: this.repoInfo.repo,
        });
        releaseData = data;
      } else {
        const { data } = await this.octokit.repos.getReleaseByTag({
          owner: this.repoInfo.owner,
          repo: this.repoInfo.repo,
          tag: tagName,
        });
        releaseData = data;
      }

      // Fetch the tag SHA for the release's tag
      let itemSha = '';
      let commitSha = '';
      try {
        const { data: refData } = await this.octokit.git.getRef({
          owner: this.repoInfo.owner,
          repo: this.repoInfo.repo,
          ref: `tags/${releaseData.tag_name}`,
        });
        itemSha = refData.object.sha;
        
        // Get commit SHA from tag
        if (refData.object.type === 'tag') {
          try {
            const { data: tagData } = await this.octokit.git.getTag({
              owner: this.repoInfo.owner,
              repo: this.repoInfo.repo,
              tag_sha: itemSha,
            });
            commitSha = tagData.object.sha;
          } catch {
            commitSha = itemSha;
          }
        } else {
          commitSha = itemSha;
        }
      } catch (error) {
        // If we can't get the tag ref, leave SHAs empty
      }

      return {
        exists: true,
        name: releaseData.tag_name,
        item_sha: itemSha,
        item_type: ItemType.RELEASE,
        commit_sha: commitSha,
        details: releaseData.body || '',
        verified: false,
        is_draft: releaseData.draft || false,
        is_prerelease: releaseData.prerelease || false,
      };
    } catch (error: unknown) {
      // Handle 404 errors (release doesn't exist)
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return {
          exists: false,
          name: tagName,
          item_sha: '',
          item_type: ItemType.RELEASE,
          commit_sha: '',
          details: '',
          verified: false,
          is_draft: false,
          is_prerelease: false,
        };
      }

      // Re-throw other errors with formatted message
      if (error instanceof Error) {
        throw new Error(`Failed to get release info from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get release info from GitHub: ${String(error)}`);
    }
  }

  /**
   * Get all tag names (optimized, no dates)
   */
  async getAllTagNames(): Promise<string[]> {
    try {
      const { data: tags } = await this.octokit.repos.listTags({
        owner: this.repoInfo.owner,
        repo: this.repoInfo.repo,
        per_page: 100,
      });

      // Extract tag names (the 'name' field contains the tag name)
      const tagNames = tags.map((tag) => tag.name).filter((name) => name);

      return tagNames;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get tag names from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get tag names from GitHub: ${String(error)}`);
    }
  }

  /**
   * Get all tags with dates
   */
  async getAllTags(): Promise<Array<{ name: string; date: string }>> {
    try {
      const { data: tags } = await this.octokit.repos.listTags({
        owner: this.repoInfo.owner,
        repo: this.repoInfo.repo,
        per_page: 100,
      });

      const allTags: Array<{ name: string; date: string }> = [];

      // Extract tag names and fetch commit dates
      for (const tag of tags) {
        const tagName = tag.name || '';
        let date = '';

        // Get commit date from the tag's commit
        try {
          const commitSha = tag.commit?.sha || '';
          if (commitSha) {
            const { data: commitData } = await this.octokit.git.getCommit({
              owner: this.repoInfo.owner,
              repo: this.repoInfo.repo,
              commit_sha: commitSha,
            });
            date = commitData.committer?.date || '';
          }
        } catch {
          // If we can't get the date, continue without it
        }

        allTags.push({ name: tagName, date });
      }

      return allTags;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get tags from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get tags from GitHub: ${String(error)}`);
    }
  }

  /**
   * Get all release names (optimized, no dates)
   */
  async getAllReleaseNames(): Promise<string[]> {
    try {
      const { data: releases } = await this.octokit.repos.listReleases({
        owner: this.repoInfo.owner,
        repo: this.repoInfo.repo,
        per_page: 100,
      });

      // Extract release tag names
      const releaseNames = releases.map((release) => release.tag_name).filter((name) => name);

      return releaseNames;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get release names from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get release names from GitHub: ${String(error)}`);
    }
  }

  /**
   * Get all releases with dates
   */
  async getAllReleases(): Promise<Array<{ name: string; date: string }>> {
    try {
      const { data: releases } = await this.octokit.repos.listReleases({
        owner: this.repoInfo.owner,
        repo: this.repoInfo.repo,
        per_page: 100,
      });

      // Extract release tag names and published dates
      const allReleases: Array<{ name: string; date: string }> = releases.map((release) => ({
        name: release.tag_name,
        date: release.published_at || release.created_at || '',
      }));

      return allReleases;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get releases from GitHub: ${error.message}`);
      }
      throw new Error(`Failed to get releases from GitHub: ${String(error)}`);
    }
  }
}

/**
 * Detect GitHub from URL hostname
 */
export function detectFromUrlByHostname(url: URL): Platform | undefined {
  const hostname = url.hostname.toLowerCase();
  if (hostname.includes('github.com')) {
    return Platform.GITHUB;
  }
  return undefined;
}

/**
 * Detect GitHub from URL by probing API endpoints
 */
async function headOk(url: string, logger: Logger): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok || response.status === 401 || response.status === 403) {
      logger.debug(`GitHub detect: ${url} status ${response.status}`);
      return true;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug(`GitHub detect timeout: ${url}`);
    }
  }
  return false;
}

export async function detectFromUrl(url: URL, logger: Logger): Promise<Platform | undefined> {
  const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  const paths = ['/api/v3', '/api'];
  for (const path of paths) {
    if (await headOk(`${base}${path}`, logger)) {
      return Platform.GITHUB;
    }
  }
  return undefined;
}

/**
 * Determine base URL for GitHub API
 */
export function determineBaseUrl(urls: string | string[]): string | undefined {
  const urlArray = Array.isArray(urls) ? urls : [urls];

  // If explicitly provided base URL exists, use it (would be in the array)
  for (const urlStr of urlArray) {
    if (!urlStr) continue;
    try {
      const url = new URL(urlStr);
      // Check if this looks like an API URL
      if (url.pathname.includes('/api')) {
        return urlStr;
      }
    } catch {
      // Not a valid URL, skip
    }
  }

  // Default GitHub API URL
  return 'https://api.github.com';
}
