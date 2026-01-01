import * as https from 'https';
import * as http from 'http';
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
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, string> = {
      'User-Agent': 'git-tag-info-action',
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const options: https.RequestOptions | http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
    };

    // Ignore certificate errors if requested (HTTPS only)
    if (isHttps && ignoreCertErrors) {
      (options as https.RequestOptions).rejectUnauthorized = false;
    }

    const req = client.request(options, (res) => {
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
 * Get tag information from Gitea API
 */
export async function getTagInfo(
  tagName: string,
  owner: string,
  repo: string,
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<ItemInfo> {
  // Gitea API endpoint for tag refs
  const apiBase = baseUrl.replace(/\/$/, '');
  const url = `${apiBase}/api/v1/repos/${owner}/${repo}/git/refs/tags/${tagName}`;

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
        `Gitea API error: ${response.statusCode} - ${response.body}`
      );
    }

    const refData = JSON.parse(response.body);

    // Get the object SHA (could be tag or commit)
    const objectSha = refData.object?.sha || '';
    const objectType = refData.object?.type || '';

    // If it's a tag object, we need to fetch the tag object to get the commit
    let commitSha = objectSha;
    let tagMessage = '';
    let itemType = ItemType.COMMIT;
    let verified = false;

    if (objectType === 'tag') {
      // Fetch the tag object
      const tagUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/git/tags/${objectSha}`;
      const tagResponse = await httpRequest(tagUrl, token, 'GET', ignoreCertErrors);

      if (tagResponse.statusCode === 200) {
        const tagData = JSON.parse(tagResponse.body);
        commitSha = tagData.object?.sha || objectSha;
        tagMessage = tagData.message || '';
        itemType = ItemType.TAG;
        // Gitea doesn't provide verification status in the same way
        verified = false;
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get tag info from Gitea: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all tags from Gitea repository
 */
export async function getAllTags(
  owner: string,
  repo: string,
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<Array<{ name: string; date: string }>> {
  const apiBase = baseUrl.replace(/\/$/, '');
  const url = `${apiBase}/api/v1/repos/${owner}/${repo}/tags?limit=100`;

  try {
    const allTags: Array<{ name: string; date: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageUrl = `${url}&page=${page}`;
      const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);

      if (response.statusCode !== 200) {
        throw new Error(
          `Gitea API error: ${response.statusCode} - ${response.body}`
        );
      }

      const tags = JSON.parse(response.body);
      if (!Array.isArray(tags) || tags.length === 0) {
        hasMore = false;
        break;
      }

      // Extract tag names and commit dates
      for (const tag of tags) {
        const tagName = tag.name || '';
        const date = tag.commit?.created || tag.commit?.timestamp || '';

        allTags.push({ name: tagName, date });
      }

      // Check if there are more pages
      if (tags.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allTags;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get tags from Gitea: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get release information from Gitea API
 */
export async function getReleaseInfo(
  tagName: string,
  owner: string,
  repo: string,
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<ItemInfo> {
  const apiBase = baseUrl.replace(/\/$/, '');
  
  try {
    let releaseUrl: string;
    if (tagName.toLowerCase() === 'latest') {
      // Get latest release
      releaseUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/releases/latest`;
    } else {
      // Get release by tag
      releaseUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/releases/tags/${tagName}`;
    }

    const response = await httpRequest(releaseUrl, token, 'GET', ignoreCertErrors);

    if (response.statusCode === 404) {
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

    if (response.statusCode !== 200) {
      throw new Error(
        `Gitea API error: ${response.statusCode} - ${response.body}`
      );
    }

    const releaseData = JSON.parse(response.body);

    // Fetch the tag SHA for the release's tag
    let itemSha = '';
    let commitSha = '';
    try {
      const tagUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/git/refs/tags/${releaseData.tag_name}`;
      const tagResponse = await httpRequest(tagUrl, token, 'GET', ignoreCertErrors);
      
      if (tagResponse.statusCode === 200) {
        const refData = JSON.parse(tagResponse.body);
        itemSha = refData.object?.sha || '';
        
        // Get commit SHA from tag object if it's an annotated tag
        if (refData.object?.type === 'tag' && itemSha) {
          const tagObjUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/git/tags/${itemSha}`;
          const tagObjResponse = await httpRequest(tagObjUrl, token, 'GET', ignoreCertErrors);
          if (tagObjResponse.statusCode === 200) {
            const tagObjData = JSON.parse(tagObjResponse.body);
            commitSha = tagObjData.object?.sha || itemSha;
          } else {
            commitSha = itemSha;
          }
        } else {
          commitSha = itemSha;
        }
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
      details: releaseData.note || releaseData.body || '',
      verified: false,
      is_draft: releaseData.is_draft || false,
      is_prerelease: releaseData.is_prerelease || false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get release info from Gitea: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all release names from Gitea repository
 */
export async function getAllReleaseNames(
  owner: string,
  repo: string,
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<string[]> {
  const apiBase = baseUrl.replace(/\/$/, '');
  const url = `${apiBase}/api/v1/repos/${owner}/${repo}/releases?limit=100`;

  try {
    const allReleaseNames: string[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageUrl = `${url}&page=${page}`;
      const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);

      if (response.statusCode !== 200) {
        throw new Error(
          `Gitea API error: ${response.statusCode} - ${response.body}`
        );
      }

      const releases = JSON.parse(response.body);
      if (!Array.isArray(releases) || releases.length === 0) {
        hasMore = false;
        break;
      }

      // Extract release tag names
      for (const release of releases) {
        if (release.tag_name) {
          allReleaseNames.push(release.tag_name);
        }
      }

      // Check if there are more pages
      if (releases.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allReleaseNames;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get release names from Gitea: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get all releases from Gitea repository with dates
 */
export async function getAllReleases(
  owner: string,
  repo: string,
  baseUrl: string,
  token?: string,
  ignoreCertErrors: boolean = false
): Promise<Array<{ name: string; date: string }>> {
  const apiBase = baseUrl.replace(/\/$/, '');
  const url = `${apiBase}/api/v1/repos/${owner}/${repo}/releases?limit=100`;

  try {
    const allReleases: Array<{ name: string; date: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageUrl = `${url}&page=${page}`;
      const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);

      if (response.statusCode !== 200) {
        throw new Error(
          `Gitea API error: ${response.statusCode} - ${response.body}`
        );
      }

      const releases = JSON.parse(response.body);
      if (!Array.isArray(releases) || releases.length === 0) {
        hasMore = false;
        break;
      }

      // Extract release tag names and published dates
      for (const release of releases) {
        if (release.tag_name) {
          allReleases.push({
            name: release.tag_name,
            date: release.published_at || release.created_at || '',
          });
        }
      }

      // Check if there are more pages
      if (releases.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allReleases;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get releases from Gitea: ${error.message}`);
    }
    throw error;
  }
}

