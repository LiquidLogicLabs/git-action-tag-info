"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalGitAPI = void 0;
exports.detectFromUrlByHostname = detectFromUrlByHostname;
exports.detectFromUrl = detectFromUrl;
exports.determineBaseUrl = determineBaseUrl;
const git_client_1 = require("../git-client");
/**
 * Local Git API client
 */
class LocalGitAPI {
    repoInfo;
    logger;
    constructor(repoInfo, config, logger) {
        if (!repoInfo.path) {
            throw new Error('Local repository path is required');
        }
        this.repoInfo = repoInfo;
        this.logger = logger;
    }
    /**
     * Get tag information
     */
    async getTagInfo(tagName) {
        if (!this.repoInfo.path) {
            throw new Error('Local repository path is required');
        }
        return (0, git_client_1.getTagInfo)(tagName, this.repoInfo.path);
    }
    /**
     * Get release information
     * Releases are not supported for local repositories
     */
    async getReleaseInfo(_tagName) {
        throw new Error('Releases are not supported for local repositories. Use tag_type: tags or query a remote repository.');
    }
    /**
     * Get all tag names (optimized, no dates)
     */
    async getAllTagNames() {
        if (!this.repoInfo.path) {
            throw new Error('Local repository path is required');
        }
        return (0, git_client_1.getAllTags)(this.repoInfo.path);
    }
    /**
     * Get all tags with dates
     * Note: Local Git doesn't easily provide dates, so we return empty dates
     */
    async getAllTags() {
        if (!this.repoInfo.path) {
            throw new Error('Local repository path is required');
        }
        const tags = (0, git_client_1.getAllTags)(this.repoInfo.path);
        // For local tags, we don't have dates easily available, so return empty dates
        return tags.map((name) => ({ name, date: '' }));
    }
    /**
     * Get all release names (optimized, no dates)
     * Releases are not supported for local repositories
     */
    async getAllReleaseNames() {
        throw new Error('Releases are not supported for local repositories');
    }
    /**
     * Get all releases with dates
     * Releases are not supported for local repositories
     */
    async getAllReleases() {
        throw new Error('Releases are not supported for local repositories');
    }
}
exports.LocalGitAPI = LocalGitAPI;
/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
function detectFromUrlByHostname(_url) {
    return undefined;
}
/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
async function detectFromUrl(_url, _logger) {
    return undefined;
}
/**
 * Determine base URL for local Git (not applicable)
 */
function determineBaseUrl(_urls) {
    return undefined;
}
//# sourceMappingURL=local.js.map