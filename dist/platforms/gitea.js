"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiteaAPI = void 0;
exports.detectFromUrlByHostname = detectFromUrlByHostname;
exports.detectFromUrl = detectFromUrl;
exports.determineBaseUrl = determineBaseUrl;
const types_1 = require("../types");
const http_client_1 = require("./http-client");
const git_fallback_1 = require("./git-fallback");
/**
 * Gitea API client
 */
class GiteaAPI {
    client;
    repoInfo;
    logger;
    apiBase;
    constructor(repoInfo, config, logger) {
        if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
        }
        this.apiBase = config.baseUrl.replace(/\/$/, '');
        // Ensure baseUrl ends with /api/v1 for Gitea
        if (!this.apiBase.endsWith('/api/v1')) {
            this.apiBase = `${this.apiBase}/api/v1`;
        }
        this.client = new http_client_1.HttpClient({
            baseUrl: this.apiBase,
            token: config.token,
            ignoreCertErrors: config.ignoreCertErrors,
            verbose: config.verbose
        }, logger);
        this.repoInfo = repoInfo;
        this.logger = logger;
    }
    /**
     * Get tag information
     */
    async getTagInfo(tagName) {
        const url = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
        try {
            const response = await this.client.get(url);
            if (response.statusCode === 404) {
                // Try fallback: check remote tags via git ls-remote if we have a repository URL
                const fallbackResult = (0, git_fallback_1.tryGitLsRemoteFallback)(tagName, this.repoInfo.url, this.logger);
                if (fallbackResult) {
                    return fallbackResult;
                }
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
                const tagUrl = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/tags/${objectSha}`;
                const tagResponse = await this.client.get(tagUrl);
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
     * Get release information
     */
    async getReleaseInfo(tagName) {
        try {
            let releaseUrl;
            if (tagName.toLowerCase() === 'latest') {
                // Get latest release
                releaseUrl = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/releases/latest`;
            }
            else {
                // Get release by tag
                releaseUrl = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/releases/tags/${tagName}`;
            }
            const response = await this.client.get(releaseUrl);
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
                const tagUrl = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${releaseData.tag_name}`;
                const tagResponse = await this.client.get(tagUrl);
                if (tagResponse.statusCode === 200) {
                    const refData = JSON.parse(tagResponse.body);
                    itemSha = refData.object?.sha || '';
                    // Get commit SHA from tag object if it's an annotated tag
                    if (refData.object?.type === 'tag' && itemSha) {
                        const tagObjUrl = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/tags/${itemSha}`;
                        const tagObjResponse = await this.client.get(tagObjUrl);
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
            catch {
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
     * Get all tag names (optimized, no dates)
     */
    async getAllTagNames() {
        const url = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/tags?limit=100`;
        try {
            const allTagNames = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const pageUrl = `${url}&page=${page}`;
                const response = await this.client.get(pageUrl);
                if (response.statusCode !== 200) {
                    throw new Error(`Gitea API error: ${response.statusCode} - ${response.body}`);
                }
                const tags = JSON.parse(response.body);
                if (!Array.isArray(tags) || tags.length === 0) {
                    hasMore = false;
                    break;
                }
                // Extract tag names
                for (const tag of tags) {
                    if (tag.name) {
                        allTagNames.push(tag.name);
                    }
                }
                // Check if there are more pages
                if (tags.length < 100) {
                    hasMore = false;
                }
                else {
                    page++;
                }
            }
            return allTagNames;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to get tag names from Gitea: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Get all tags with dates
     */
    async getAllTags() {
        const url = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/tags?limit=100`;
        try {
            const allTags = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const pageUrl = `${url}&page=${page}`;
                const response = await this.client.get(pageUrl);
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
     * Get all release names (optimized, no dates)
     */
    async getAllReleaseNames() {
        const url = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/releases?limit=100`;
        try {
            const allReleaseNames = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const pageUrl = `${url}&page=${page}`;
                const response = await this.client.get(pageUrl);
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
     * Get all releases with dates
     */
    async getAllReleases() {
        const url = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/releases?limit=100`;
        try {
            const allReleases = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const pageUrl = `${url}&page=${page}`;
                const response = await this.client.get(pageUrl);
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
}
exports.GiteaAPI = GiteaAPI;
/**
 * Detect Gitea from URL hostname
 */
function detectFromUrlByHostname(url) {
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('gitea.com') || hostname.includes('gitea')) {
        return types_1.Platform.GITEA;
    }
    return undefined;
}
/**
 * Detect Gitea from URL by probing API endpoints
 */
async function headOk(url, logger) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok || response.status === 401 || response.status === 403) {
            logger.debug(`Gitea detect: ${url} status ${response.status}`);
            return true;
        }
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            logger.debug(`Gitea detect timeout: ${url}`);
        }
    }
    return false;
}
async function detectFromUrl(url, logger) {
    const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const paths = ['/api/v1/version'];
    for (const path of paths) {
        if (await headOk(`${base}${path}`, logger)) {
            return types_1.Platform.GITEA;
        }
    }
    return undefined;
}
/**
 * Determine base URL for Gitea API
 */
function determineBaseUrl(urls) {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    // Check if first URL is an explicit API URL (contains /api)
    if (urlArray.length > 0 && urlArray[0]) {
        try {
            const url = new URL(urlArray[0]);
            if (url.pathname.includes('/api')) {
                return urlArray[0];
            }
        }
        catch {
            // Not a valid URL, continue
        }
    }
    // Check repository/origin URLs to derive API URL
    for (const urlStr of urlArray) {
        if (!urlStr)
            continue;
        try {
            const url = new URL(urlStr);
            const baseUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/api/v1`;
            return baseUrl;
        }
        catch {
            // Not a valid URL, skip
        }
    }
    // Check environment variables
    const serverUrl = process.env.GITHUB_SERVER_URL || process.env.GITEA_SERVER_URL || process.env.GITEA_API_URL;
    if (serverUrl) {
        return `${serverUrl.replace(/\/$/, '')}/api/v1`;
    }
    // Default Gitea API URL
    return 'https://gitea.com/api/v1';
}
//# sourceMappingURL=gitea.js.map