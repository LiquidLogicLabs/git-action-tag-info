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
exports.GitHubAPI = void 0;
exports.detectFromUrlByHostname = detectFromUrlByHostname;
exports.detectFromUrl = detectFromUrl;
exports.determineBaseUrl = determineBaseUrl;
const https = __importStar(require("https"));
const rest_1 = require("@octokit/rest");
const plugin_throttling_1 = require("@octokit/plugin-throttling");
const core = __importStar(require("@actions/core"));
const types_1 = require("../types");
// Create Octokit with throttling plugin for automatic rate limit handling
const ThrottledOctokit = rest_1.Octokit.plugin(plugin_throttling_1.throttling);
/**
 * Create an Octokit instance with optional authentication, certificate validation, and rate limit handling
 */
function createOctokit(baseUrl, token, ignoreCertErrors = false) {
    const options = {
        auth: token,
        baseUrl: baseUrl || 'https://api.github.com',
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
 * GitHub API client
 */
class GitHubAPI {
    octokit;
    repoInfo;
    logger;
    constructor(repoInfo, config, logger) {
        const baseUrl = config.baseUrl || 'https://api.github.com';
        this.octokit = createOctokit(baseUrl, config.token, config.ignoreCertErrors);
        this.repoInfo = repoInfo;
        this.logger = logger;
    }
    /**
     * Get tag information
     */
    async getTagInfo(tagName) {
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
            let itemType = types_1.ItemType.COMMIT;
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
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
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
     * Get release information
     */
    async getReleaseInfo(tagName) {
        try {
            // Get release by tag name or latest if tagName is "latest"
            let releaseData;
            if (tagName.toLowerCase() === 'latest') {
                const { data } = await this.octokit.repos.getLatestRelease({
                    owner: this.repoInfo.owner,
                    repo: this.repoInfo.repo,
                });
                releaseData = data;
            }
            else {
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
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
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
     * Get all tag names (optimized, no dates)
     */
    async getAllTagNames() {
        try {
            const { data: tags } = await this.octokit.repos.listTags({
                owner: this.repoInfo.owner,
                repo: this.repoInfo.repo,
                per_page: 100,
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
     * Get all tags with dates
     */
    async getAllTags() {
        try {
            const { data: tags } = await this.octokit.repos.listTags({
                owner: this.repoInfo.owner,
                repo: this.repoInfo.repo,
                per_page: 100,
            });
            const allTags = [];
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
     * Get all release names (optimized, no dates)
     */
    async getAllReleaseNames() {
        try {
            const { data: releases } = await this.octokit.repos.listReleases({
                owner: this.repoInfo.owner,
                repo: this.repoInfo.repo,
                per_page: 100,
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
     * Get all releases with dates
     */
    async getAllReleases() {
        try {
            const { data: releases } = await this.octokit.repos.listReleases({
                owner: this.repoInfo.owner,
                repo: this.repoInfo.repo,
                per_page: 100,
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
}
exports.GitHubAPI = GitHubAPI;
/**
 * Detect GitHub from URL hostname
 */
function detectFromUrlByHostname(url) {
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('github.com')) {
        return types_1.Platform.GITHUB;
    }
    return undefined;
}
/**
 * Detect GitHub from URL by probing API endpoints
 */
async function headOk(url, logger) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok || response.status === 401 || response.status === 403) {
            logger.debug(`GitHub detect: ${url} status ${response.status}`);
            return true;
        }
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            logger.debug(`GitHub detect timeout: ${url}`);
        }
    }
    return false;
}
async function detectFromUrl(url, logger) {
    const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const paths = ['/api/v3', '/api'];
    for (const path of paths) {
        if (await headOk(`${base}${path}`, logger)) {
            return types_1.Platform.GITHUB;
        }
    }
    return undefined;
}
/**
 * Determine base URL for GitHub API
 */
function determineBaseUrl(urls) {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    // If explicitly provided base URL exists, use it (would be in the array)
    for (const urlStr of urlArray) {
        if (!urlStr)
            continue;
        try {
            const url = new URL(urlStr);
            // Check if this looks like an API URL
            if (url.pathname.includes('/api')) {
                return urlStr;
            }
        }
        catch {
            // Not a valid URL, skip
        }
    }
    // Default GitHub API URL
    return 'https://api.github.com';
}
//# sourceMappingURL=github.js.map