import * as https from 'https';
import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, ItemType, Platform, HttpResponse } from '../types';
import { Logger } from '../logger';

/**
 * Make HTTP request for Bitbucket (uses Basic Auth)
 */
async function httpRequest(
  url: string,
  token: string | undefined,
  ignoreCertErrors: boolean,
  logger: Logger
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const headers: Record<string, string> = {
      'User-Agent': 'git-action-tag-info',
      Accept: 'application/json',
    };

    if (token) {
      // Bitbucket uses Basic Auth with app password or token
      const auth = Buffer.from(`:${token}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    };

    // Ignore certificate errors if requested
    if (ignoreCertErrors) {
      options.rejectUnauthorized = false;
    }

    // Log request if verbose
    if (logger.verbose) {
      const sanitizedHeaders = { ...headers };
      if (sanitizedHeaders.Authorization) {
        sanitizedHeaders.Authorization = '***';
      }
      logger.debug(`HTTP GET ${url}`);
      logger.debug(`Headers: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
    }

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const response: HttpResponse = {
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        };

        // Log response if verbose
        if (logger.verbose) {
          logger.debug(`HTTP Response: ${response.statusCode} ${res.statusMessage || ''}`);
          try {
            const parsedBody = JSON.parse(body);
            logger.debug(`Response body: ${JSON.stringify(parsedBody, null, 2)}`);
          } catch {
            logger.debug(`Response body: ${body.substring(0, 200)}...`);
          }
        }

        resolve(response);
      });
    });

    req.on('error', (error) => {
      if (logger.verbose) {
        logger.debug(`Request error: ${error.message}`);
      }
      reject(error);
    });

    req.end();
  });
}

/**
 * Bitbucket API client
 */
export class BitbucketAPI implements PlatformAPI {
  private repoInfo: RepositoryInfo;
  private config: PlatformConfig;
  private logger: Logger;
  private baseUrl: string;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    this.repoInfo = repoInfo;
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.baseUrl || 'https://api.bitbucket.org/2.0';
  }

  /**
   * Get tag information
   */
  async getTagInfo(tagName: string): Promise<ItemInfo> {
    const url = `${this.baseUrl}/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags/${tagName}`;

    try {
      const response = await httpRequest(url, this.config.token, this.config.ignoreCertErrors, this.logger);

      if (response.statusCode === 404) {
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

      if (response.statusCode !== 200) {
        throw new Error(
          `Bitbucket API error: ${response.statusCode} - ${response.body}`
        );
      }

      const tagData = JSON.parse(response.body);

      // Bitbucket returns tag information directly
      const tagSha = tagData.target?.hash || '';
      const commitSha = tagData.target?.hash || ''; // Bitbucket tags point directly to commits
      const tagMessage = tagData.message || '';
      const itemType = tagData.type === 'tag' ? ItemType.TAG : ItemType.COMMIT;
      const verified = false; // Bitbucket doesn't provide GPG verification status via API

      return {
        exists: true,
        name: tagName,
        item_sha: tagSha,
        item_type: itemType,
        commit_sha: commitSha,
        details: tagMessage,
        verified,
        is_draft: false,
        is_prerelease: false,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get tag info from Bitbucket: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get release information
   * Note: Bitbucket doesn't have a dedicated releases API like GitHub/Gitea.
   * Releases in Bitbucket are typically just tags. We'll use the tags endpoint
   * and return release-like information.
   */
  async getReleaseInfo(tagName: string): Promise<ItemInfo> {
    // Bitbucket doesn't have a separate releases API, so we'll use tags
    // and return them as releases. The tag info will be returned as release info.
    const tagInfo = await this.getTagInfo(tagName);
    
    if (!tagInfo.exists) {
      return {
        ...tagInfo,
        item_type: ItemType.RELEASE,
        is_draft: false,
        is_prerelease: false,
      };
    }

    // Bitbucket doesn't support draft/prerelease flags via API
    return {
      ...tagInfo,
      item_type: ItemType.RELEASE,
      is_draft: false,
      is_prerelease: false,
    };
  }

  /**
   * Get all tag names (optimized, no dates)
   */
  async getAllTagNames(): Promise<string[]> {
    const url = `${this.baseUrl}/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags?pagelen=100`;

    try {
      const allTagNames: string[] = [];
      let nextUrl: string | null = url;

      while (nextUrl) {
        const response = await httpRequest(nextUrl, this.config.token, this.config.ignoreCertErrors, this.logger);

        if (response.statusCode !== 200) {
          throw new Error(
            `Bitbucket API error: ${response.statusCode} - ${response.body}`
          );
        }

        const data = JSON.parse(response.body);
        const tags = data.values || [];

        if (tags.length === 0) {
          break;
        }

        // Extract tag names
        for (const tag of tags) {
          if (tag.name) {
            allTagNames.push(tag.name);
          }
        }

        // Check for next page
        nextUrl = data.next || null;
      }

      return allTagNames;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get tag names from Bitbucket: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all tags with dates
   */
  async getAllTags(): Promise<Array<{ name: string; date: string }>> {
    const url = `${this.baseUrl}/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags?pagelen=100`;

    try {
      const allTags: Array<{ name: string; date: string }> = [];
      let nextUrl: string | null = url;

      while (nextUrl) {
        const response = await httpRequest(nextUrl, this.config.token, this.config.ignoreCertErrors, this.logger);

        if (response.statusCode !== 200) {
          throw new Error(
            `Bitbucket API error: ${response.statusCode} - ${response.body}`
          );
        }

        const data = JSON.parse(response.body);
        const tags = data.values || [];

        if (tags.length === 0) {
          break;
        }

        // Extract tag names and dates
        for (const tag of tags) {
          const tagName = tag.name || '';
          const date = tag.target?.date || tag.date || '';

          allTags.push({ name: tagName, date });
        }

        // Check for next page
        nextUrl = data.next || null;
      }

      return allTags;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get tags from Bitbucket: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all release names (optimized, no dates)
   * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names
   */
  async getAllReleaseNames(): Promise<string[]> {
    // Bitbucket doesn't have releases, so return tag names
    return this.getAllTagNames();
  }

  /**
   * Get all releases with dates
   * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names with dates
   */
  async getAllReleases(): Promise<Array<{ name: string; date: string }>> {
    // Bitbucket doesn't have releases, so return tags with dates
    return this.getAllTags();
  }
}

/**
 * Detect Bitbucket from URL hostname
 */
export function detectFromUrlByHostname(url: URL): Platform | undefined {
  const hostname = url.hostname.toLowerCase();
  if (hostname.includes('bitbucket.org') || hostname.includes('bitbucket')) {
    return Platform.BITBUCKET;
  }
  return undefined;
}

/**
 * Detect Bitbucket from URL by probing API endpoints
 */
async function headOk(url: string, logger: Logger): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok || response.status === 401 || response.status === 403) {
      logger.debug(`Bitbucket detect: ${url} status ${response.status}`);
      return true;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug(`Bitbucket detect timeout: ${url}`);
    }
  }
  return false;
}

export async function detectFromUrl(url: URL, logger: Logger): Promise<Platform | undefined> {
  const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  const paths = ['/2.0/repositories'];
  for (const path of paths) {
    if (await headOk(`${base}${path}`, logger)) {
      return Platform.BITBUCKET;
    }
  }
  return undefined;
}

/**
 * Determine base URL for Bitbucket API
 */
export function determineBaseUrl(urls: string | string[]): string | undefined {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  
  // Check if first URL is an explicit API URL (contains /2.0 or /api)
  if (urlArray.length > 0 && urlArray[0]) {
    try {
      const url = new URL(urlArray[0]);
      if (url.pathname.includes('/2.0') || url.pathname.includes('/api')) {
        return urlArray[0];
      }
    } catch {
      // Not a valid URL, continue
    }
  }
  
  // Check repository/origin URLs to derive API URL
  for (const urlStr of urlArray) {
    if (!urlStr) continue;
    try {
      const url = new URL(urlStr);
      // Bitbucket API is at /2.0
      const baseUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/2.0`;
      return baseUrl;
    } catch {
      // Not a valid URL, skip
    }
  }
  
  // Default Bitbucket API URL
  return 'https://api.bitbucket.org/2.0';
}
