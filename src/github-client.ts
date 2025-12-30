import * as https from 'https';
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import * as core from '@actions/core';
import { TagInfo, TagType } from './types';

// Create Octokit with throttling plugin for automatic rate limit handling
const ThrottledOctokit = Octokit.plugin(throttling);

/**
 * Create an Octokit instance with optional authentication, certificate validation, and rate limit handling
 */
function createOctokit(token?: string, ignoreCertErrors: boolean = false): InstanceType<typeof ThrottledOctokit> {
  const options: ConstructorParameters<typeof ThrottledOctokit>[0] = {
    auth: token,
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
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
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
 * Get tag information from GitHub API
 */
export async function getTagInfo(
  tagName: string,
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<TagInfo> {
  const octokit = createOctokit(token, ignoreCertErrors);

  try {
    // Get the tag ref
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `tags/${tagName}`,
    });

    // Get the object SHA (could be tag or commit)
    const objectSha = refData.object.sha;
    const objectType = refData.object.type;

    // If it's a tag object, we need to fetch the tag object to get the commit
    let commitSha = objectSha;
    let tagMessage = '';
    let tagType = TagType.COMMIT;
    let verified = false;

    if (objectType === 'tag') {
      // Fetch the tag object
      try {
        const { data: tagData } = await octokit.git.getTag({
          owner,
          repo,
          tag_sha: objectSha,
        });
        commitSha = tagData.object.sha;
        tagMessage = tagData.message || '';
        tagType = TagType.ANNOTATED;
        verified = tagData.verification?.verified || false;
      } catch (error) {
        // If we can't get the tag object, use the ref data
        // This shouldn't happen, but handle gracefully
      }
    }

    return {
      exists: true,
      tag_name: tagName,
      tag_sha: objectSha,
      tag_type: tagType,
      commit_sha: commitSha,
      tag_message: tagMessage,
      verified,
    };
  } catch (error: any) {
    // Handle 404 errors (tag doesn't exist)
    if (error.status === 404) {
      return {
        exists: false,
        tag_name: tagName,
        tag_sha: '',
        tag_type: TagType.COMMIT,
        commit_sha: '',
        tag_message: '',
        verified: false,
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
 * Get all tag names from GitHub repository (fast, no dates)
 * This is optimized for cases where dates are not needed (e.g., semver sorting)
 * Uses the /repos/{owner}/{repo}/tags endpoint which returns tags in reverse
 * chronological order (newest first), so we can limit to the first page
 * to get the most recent tags.
 */
export async function getAllTagNames(
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false,
  maxTags: number = 100
): Promise<string[]> {
  const octokit = createOctokit(token, ignoreCertErrors);

  try {
    const { data: tags } = await octokit.repos.listTags({
      owner,
      repo,
      per_page: Math.min(maxTags, 100),
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
 * Get all tags from GitHub repository with dates
 * Note: This makes many API calls (1 per tag for commit dates). Consider using getAllTagNames() first
 * if dates are not needed (e.g., for semver sorting).
 * Uses the /repos/{owner}/{repo}/tags endpoint which returns tags sorted by date (newest first),
 * allowing us to limit to the most recent tags.
 */
export async function getAllTags(
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false,
  maxTags: number = 100
): Promise<Array<{ name: string; date: string }>> {
  const octokit = createOctokit(token, ignoreCertErrors);

  try {
    const { data: tags } = await octokit.repos.listTags({
      owner,
      repo,
      per_page: Math.min(maxTags, 100),
    });

    const allTags: Array<{ name: string; date: string }> = [];

    // Extract tag names and fetch commit dates
    for (const tag of tags) {
      const tagName = tag.name || '';
      let date = '';

      // Get commit date from the tag's commit
      // The /tags endpoint includes a commit object with SHA, but not the full commit details
      // So we need to fetch the commit to get the date
      try {
        const commitSha = tag.commit?.sha || '';
        if (commitSha) {
          const { data: commitData } = await octokit.git.getCommit({
            owner,
            repo,
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
