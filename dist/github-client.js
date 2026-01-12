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
exports.getAllTagNames = getAllTagNames;
exports.getAllTags = getAllTags;
exports.getReleaseInfo = getReleaseInfo;
exports.getAllReleaseNames = getAllReleaseNames;
exports.getAllReleases = getAllReleases;
const https = __importStar(require("https"));
const rest_1 = require("@octokit/rest");
const plugin_throttling_1 = require("@octokit/plugin-throttling");
const core = __importStar(require("@actions/core"));
const types_1 = require("./types");
// Create Octokit with throttling plugin for automatic rate limit handling
const ThrottledOctokit = rest_1.Octokit.plugin(plugin_throttling_1.throttling);
/**
 * Create an Octokit instance with optional authentication, certificate validation, and rate limit handling
 */
function createOctokit(token, ignoreCertErrors = false) {
    const options = {
        auth: token,
        throttle: {
            onRateLimit: (retryAfter, options, octokit, retryCount) => {
                core.warning(`Rate limit exceeded for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds...`);
                // Retry up to 2 times
                if (retryCount < 2) {
                    return true;
                }
                return false;
            },
            onSecondaryRateLimit: (retryAfter, options, _octokit) => {
                core.warning(`Secondary rate limit detected for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds...`);
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
async function getTagInfo(tagName, owner, repo, token, ignoreCertErrors = false) {
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
        let itemType = types_1.ItemType.COMMIT;
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
                itemType = types_1.ItemType.TAG;
                verified = tagData.verification?.verified || false;
            }
            catch (error) {
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
    }
    catch (error) {
        // Handle 404 errors (tag doesn't exist)
        if (error.status === 404) {
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
async function getAllTagNames(owner, repo, token, ignoreCertErrors = false, maxTags = 100) {
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
    }
    catch (error) {
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
async function getAllTags(owner, repo, token, ignoreCertErrors = false, maxTags = 100) {
    const octokit = createOctokit(token, ignoreCertErrors);
    try {
        const { data: tags } = await octokit.repos.listTags({
            owner,
            repo,
            per_page: Math.min(maxTags, 100),
        });
        const allTags = [];
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
            }
            catch {
                // If we can't get the date, continue without it
            }
            allTags.push({ name: tagName, date });
        }
        return allTags;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get tags from GitHub: ${error.message}`);
        }
        throw new Error(`Failed to get tags from GitHub: ${String(error)}`);
    }
}
/**
 * Get release information from GitHub API
 */
async function getReleaseInfo(tagName, owner, repo, token, ignoreCertErrors = false) {
    const octokit = createOctokit(token, ignoreCertErrors);
    try {
        // Get release by tag name or latest if tagName is "latest"
        let releaseData;
        if (tagName.toLowerCase() === 'latest') {
            const { data } = await octokit.repos.getLatestRelease({
                owner,
                repo,
            });
            releaseData = data;
        }
        else {
            const { data } = await octokit.repos.getReleaseByTag({
                owner,
                repo,
                tag: tagName,
            });
            releaseData = data;
        }
        // Fetch the tag SHA for the release's tag
        let itemSha = '';
        let commitSha = '';
        try {
            const { data: refData } = await octokit.git.getRef({
                owner,
                repo,
                ref: `tags/${releaseData.tag_name}`,
            });
            itemSha = refData.object.sha;
            // Get commit SHA from tag
            if (refData.object.type === 'tag') {
                try {
                    const { data: tagData } = await octokit.git.getTag({
                        owner,
                        repo,
                        tag_sha: itemSha,
                    });
                    commitSha = tagData.object.sha;
                }
                catch {
                    commitSha = itemSha;
                }
            }
            else {
                commitSha = itemSha;
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
            details: releaseData.body || '',
            verified: false,
            is_draft: releaseData.draft || false,
            is_prerelease: releaseData.prerelease || false,
        };
    }
    catch (error) {
        // Handle 404 errors (release doesn't exist)
        if (error.status === 404) {
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
        // Re-throw other errors with formatted message
        if (error instanceof Error) {
            throw new Error(`Failed to get release info from GitHub: ${error.message}`);
        }
        throw new Error(`Failed to get release info from GitHub: ${String(error)}`);
    }
}
/**
 * Get all release names from GitHub repository
 */
async function getAllReleaseNames(owner, repo, token, ignoreCertErrors = false, maxReleases = 100) {
    const octokit = createOctokit(token, ignoreCertErrors);
    try {
        const { data: releases } = await octokit.repos.listReleases({
            owner,
            repo,
            per_page: Math.min(maxReleases, 100),
        });
        // Extract release tag names
        const releaseNames = releases.map((release) => release.tag_name).filter((name) => name);
        return releaseNames;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get release names from GitHub: ${error.message}`);
        }
        throw new Error(`Failed to get release names from GitHub: ${String(error)}`);
    }
}
/**
 * Get all releases from GitHub repository with dates
 */
async function getAllReleases(owner, repo, token, ignoreCertErrors = false, maxReleases = 100) {
    const octokit = createOctokit(token, ignoreCertErrors);
    try {
        const { data: releases } = await octokit.repos.listReleases({
            owner,
            repo,
            per_page: Math.min(maxReleases, 100),
        });
        // Extract release tag names and published dates
        const allReleases = releases.map((release) => ({
            name: release.tag_name,
            date: release.published_at || release.created_at || '',
        }));
        return allReleases;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get releases from GitHub: ${error.message}`);
        }
        throw new Error(`Failed to get releases from GitHub: ${String(error)}`);
    }
}
//# sourceMappingURL=github-client.js.map