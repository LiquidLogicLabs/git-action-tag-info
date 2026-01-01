"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTagInfo = getTagInfo;
exports.getAllTags = getAllTags;
exports.getReleaseInfo = getReleaseInfo;
exports.getAllReleaseNames = getAllReleaseNames;
exports.getAllReleases = getAllReleases;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const types_1 = require("./types");
/**
 * Make HTTP request
 */
function httpRequest(url, token, method = 'GET', ignoreCertErrors = false) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        const headers = {
            'User-Agent': 'git-tag-info-action',
            Accept: 'application/json',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
        };
        // Ignore certificate errors if requested (HTTPS only)
        if (isHttps && ignoreCertErrors) {
            options.rejectUnauthorized = false;
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
async function getTagInfo(tagName, owner, repo, baseUrl, token, ignoreCertErrors = false) {
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
                item_type: types_1.ItemType.COMMIT,
                commit_sha: '',
                details: '',
                verified: false,
                is_draft: false,
                is_prerelease: false,
            };
        }
        if (response.statusCode !== 200) {
            throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
        }
        const refData = JSON.parse(response.body);
        // Get the object SHA (could be tag or commit)
        const objectSha = refData.object?.sha || '';
        const objectType = refData.object?.type || '';
        // If it's a tag object, we need to fetch the tag object to get the commit
        let commitSha = objectSha;
        let tagMessage = '';
        let itemType = types_1.ItemType.COMMIT;
        let verified = false;
        if (objectType === 'tag') {
            // Fetch the tag object
            const tagUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/git/tags/${objectSha}`;
            const tagResponse = await httpRequest(tagUrl, token, 'GET', ignoreCertErrors);
            if (tagResponse.statusCode === 200) {
                const tagData = JSON.parse(tagResponse.body);
                commitSha = tagData.object?.sha || objectSha;
                tagMessage = tagData.message || '';
                itemType = types_1.ItemType.TAG;
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
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get tag info from Gitea: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Get all tags from Gitea repository
 */
async function getAllTags(owner, repo, baseUrl, token, ignoreCertErrors = false) {
    const apiBase = baseUrl.replace(/\/$/, '');
    const url = `${apiBase}/api/v1/repos/${owner}/${repo}/tags?limit=100`;
    try {
        const allTags = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const pageUrl = `${url}&page=${page}`;
            const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);
            if (response.statusCode !== 200) {
                throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
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
            }
            else {
                page++;
            }
        }
        return allTags;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get tags from Gitea: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Get release information from Gitea API
 */
async function getReleaseInfo(tagName, owner, repo, baseUrl, token, ignoreCertErrors = false) {
    const apiBase = baseUrl.replace(/\/$/, '');
    try {
        let releaseUrl;
        if (tagName.toLowerCase() === 'latest') {
            // Get latest release
            releaseUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/releases/latest`;
        }
        else {
            // Get release by tag
            releaseUrl = `${apiBase}/api/v1/repos/${owner}/${repo}/releases/tags/${tagName}`;
        }
        const response = await httpRequest(releaseUrl, token, 'GET', ignoreCertErrors);
        if (response.statusCode === 404) {
            return {
                exists: false,
                name: tagName,
                item_sha: '',
                item_type: types_1.ItemType.RELEASE,
                commit_sha: '',
                details: '',
                verified: false,
                is_draft: false,
                is_prerelease: false,
            };
        }
        if (response.statusCode !== 200) {
            throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
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
                    }
                    else {
                        commitSha = itemSha;
                    }
                }
                else {
                    commitSha = itemSha;
                }
            }
        }
        catch (error) {
            // If we can't get the tag ref, leave SHAs empty
        }
        return {
            exists: true,
            name: releaseData.tag_name,
            item_sha: itemSha,
            item_type: types_1.ItemType.RELEASE,
            commit_sha: commitSha,
            details: releaseData.note || releaseData.body || '',
            verified: false,
            is_draft: releaseData.is_draft || false,
            is_prerelease: releaseData.is_prerelease || false,
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get release info from Gitea: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Get all release names from Gitea repository
 */
async function getAllReleaseNames(owner, repo, baseUrl, token, ignoreCertErrors = false) {
    const apiBase = baseUrl.replace(/\/$/, '');
    const url = `${apiBase}/api/v1/repos/${owner}/${repo}/releases?limit=100`;
    try {
        const allReleaseNames = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const pageUrl = `${url}&page=${page}`;
            const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);
            if (response.statusCode !== 200) {
                throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
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
            }
            else {
                page++;
            }
        }
        return allReleaseNames;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get release names from Gitea: ${error.message}`);
        }
        throw error;
    }
}
/**
 * Get all releases from Gitea repository with dates
 */
async function getAllReleases(owner, repo, baseUrl, token, ignoreCertErrors = false) {
    const apiBase = baseUrl.replace(/\/$/, '');
    const url = `${apiBase}/api/v1/repos/${owner}/${repo}/releases?limit=100`;
    try {
        const allReleases = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const pageUrl = `${url}&page=${page}`;
            const response = await httpRequest(pageUrl, token, 'GET', ignoreCertErrors);
            if (response.statusCode !== 200) {
                throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
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
            }
            else {
                page++;
            }
        }
        return allReleases;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get releases from Gitea: ${error.message}`);
        }
        throw error;
    }
}
//# sourceMappingURL=gitea-client.js.map