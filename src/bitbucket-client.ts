import * as https from 'https';
import { ItemInfo, ItemType, HttpResponse } from './types';

/**
 * Make HTTP request
 */
function httpRequest(
  url: string,
  token?: string,
  method: string = 'GET',
  ignoreCertErrors: boolean = false
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const headers: Record<string, string> = {
      'User-Agent': 'git-tag-info-action',
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
      method,
      headers,
    };

    // Ignore certificate errors if requested
    if (ignoreCertErrors) {
      options.rejectUnauthorized = false;
    }

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Get tag information from Bitbucket API
 */
export async function getTagInfo(
  tagName: string,
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<ItemInfo> {
  // Bitbucket API endpoint for tag refs
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/tags/${tagName}`;

  try {
    const response = await httpRequest(url, token, 'GET', ignoreCertErrors);

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
 * Get all tags from Bitbucket repository
 */
export async function getAllTags(
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<Array<{ name: string; date: string }>> {
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/tags?pagelen=100`;

  try {
    const allTags: Array<{ name: string; date: string }> = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await httpRequest(nextUrl, token, 'GET', ignoreCertErrors);

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
 * Get release information from Bitbucket API
 * Note: Bitbucket doesn't have a dedicated releases API like GitHub/Gitea.
 * Releases in Bitbucket are typically just tags. We'll try to use the tags endpoint
 * and return release-like information if available.
 */
export async function getReleaseInfo(
  tagName: string,
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<ItemInfo> {
  // Bitbucket doesn't have a separate releases API, so we'll use tags
  // and return them as releases. The tag info will be returned as release info.
  const tagInfo = await getTagInfo(tagName, owner, repo, token, ignoreCertErrors);
  
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
 * Get all release names from Bitbucket repository
 * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names
 */
export async function getAllReleaseNames(
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<string[]> {
  // Bitbucket doesn't have releases, so return tag names
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/tags?pagelen=100`;

  try {
    const allReleaseNames: string[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await httpRequest(nextUrl, token, 'GET', ignoreCertErrors);

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
          allReleaseNames.push(tag.name);
        }
      }

      // Check for next page
      nextUrl = data.next || null;
    }

    return allReleaseNames;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get release names from Bitbucket: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all releases from Bitbucket repository with dates
 * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names with dates
 */
export async function getAllReleases(
  owner: string,
  repo: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<Array<{ name: string; date: string }>> {
  // Bitbucket doesn't have releases, so return tags with dates
  const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/refs/tags?pagelen=100`;

  try {
    const allReleases: Array<{ name: string; date: string }> = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await httpRequest(nextUrl, token, 'GET', ignoreCertErrors);

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
        if (tag.name) {
          allReleases.push({
            name: tag.name,
            date: tag.target?.date || tag.date || '',
          });
        }
      }

      // Check for next page
      nextUrl = data.next || null;
    }

    return allReleases;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get releases from Bitbucket: ${error.message}`);
    }
    throw error;
  }
}

