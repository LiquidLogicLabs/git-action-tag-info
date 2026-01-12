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
exports.createPlatformAPI = createPlatformAPI;
const exec = __importStar(require("@actions/exec"));
const types_1 = require("../types");
const github_1 = require("./github");
const gitea_1 = require("./gitea");
const bitbucket_1 = require("./bitbucket");
const local_1 = require("./local");
const platformProviders = [
    {
        type: types_1.Platform.GITEA,
        detectFromUrlByHostname: gitea_1.detectFromUrlByHostname,
        detectFromUrl: gitea_1.detectFromUrl,
        createAPI: (repoInfo, config, logger) => new gitea_1.GiteaAPI(repoInfo, config, logger)
    },
    {
        type: types_1.Platform.GITHUB,
        detectFromUrlByHostname: github_1.detectFromUrlByHostname,
        detectFromUrl: github_1.detectFromUrl,
        createAPI: (repoInfo, config, logger) => new github_1.GitHubAPI(repoInfo, config, logger)
    },
    {
        type: types_1.Platform.BITBUCKET,
        detectFromUrlByHostname: bitbucket_1.detectFromUrlByHostname,
        detectFromUrl: bitbucket_1.detectFromUrl,
        createAPI: (repoInfo, config, logger) => new bitbucket_1.BitbucketAPI(repoInfo, config, logger)
    }
];
/**
 * Collect candidate URLs from repository URL, origin URL, and environment variables
 */
async function collectCandidateUrls(repoInfo, logger) {
    const urls = [];
    // Add repository URL if available
    if (repoInfo.url) {
        urls.push(repoInfo.url);
    }
    // Try to get origin URL from git
    try {
        const output = [];
        await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
            silent: true,
            listeners: {
                stdout: (data) => {
                    output.push(data.toString());
                }
            },
            ignoreReturnCode: true
        });
        const originUrl = output.join('').trim();
        if (originUrl && originUrl !== repoInfo.url) {
            urls.push(originUrl);
            logger.debug(`Added origin URL: ${originUrl}`);
        }
    }
    catch {
        // Git not available or no origin - skip
    }
    // Add environment variable URLs
    const envUrls = [
        process.env.GITHUB_SERVER_URL,
        process.env.GITEA_SERVER_URL,
        process.env.GITEA_API_URL
    ].filter((url) => !!url);
    for (const envUrl of envUrls) {
        if (!urls.includes(envUrl)) {
            urls.push(envUrl);
            logger.debug(`Added environment URL: ${envUrl}`);
        }
    }
    return urls;
}
async function resolvePlatform(repoInfo, explicitPlatform, logger) {
    // If explicit platform is provided and not 'auto', use it
    if (explicitPlatform && explicitPlatform !== 'auto') {
        return explicitPlatform;
    }
    // If repoInfo has explicit platform (not 'auto'), use it
    if (repoInfo.platform && repoInfo.platform !== 'auto') {
        return repoInfo.platform;
    }
    // If we have a local path, we can't detect platform from URL
    // This will be handled separately by checking if we should use LocalGitAPI
    if (repoInfo.path && (!repoInfo.owner || !repoInfo.repo)) {
        // This is a local-only repository, but we still need a platform for the API
        // We'll default to GitHub for now, but LocalGitAPI will be used instead
        logger.debug('Local repository detected, will use LocalGitAPI');
        return types_1.Platform.GITHUB; // Placeholder, LocalGitAPI will be used
    }
    // Collect candidate URLs
    const candidateUrls = await collectCandidateUrls(repoInfo, logger);
    // First loop: Try detectFromUrlByHostname on each URL
    for (const urlStr of candidateUrls) {
        try {
            const url = new URL(urlStr);
            // Try detectFromUrlByHostname from each provider
            for (const provider of platformProviders) {
                const detected = provider.detectFromUrlByHostname(url);
                if (detected) {
                    logger.debug(`Detected platform ${detected} from hostname: ${url.hostname} (URL: ${urlStr})`);
                    return detected;
                }
            }
        }
        catch {
            logger.debug(`Could not parse URL for hostname detection: ${urlStr}`);
        }
    }
    // Second loop: Try detectFromUrl (endpoint probing) on each URL
    for (const urlStr of candidateUrls) {
        try {
            const url = new URL(urlStr);
            // Try detectFromUrl from each provider
            for (const provider of platformProviders) {
                const detected = await provider.detectFromUrl(url, logger);
                if (detected) {
                    logger.debug(`Detected platform ${detected} from API probe: ${urlStr}`);
                    return detected;
                }
            }
        }
        catch {
            logger.debug(`Could not parse URL for detector probes: ${urlStr}`);
        }
    }
    // Default to GitHub if we have owner/repo but couldn't detect
    if (repoInfo.owner && repoInfo.repo) {
        logger.debug('Could not detect platform, defaulting to GitHub');
        return types_1.Platform.GITHUB;
    }
    // If we have a local path, we'll use LocalGitAPI (handled in createPlatformAPI)
    logger.debug('Could not detect platform, will use LocalGitAPI if path is available');
    return types_1.Platform.GITHUB; // Placeholder
}
async function createPlatformAPI(repoInfo, explicitPlatform, config, logger) {
    // Check if this is a local-only repository (has path but no owner/repo)
    if (repoInfo.path && (!repoInfo.owner || !repoInfo.repo)) {
        // Use LocalGitAPI for local repositories
        const platformConfig = {
            type: types_1.Platform.GITHUB, // Placeholder, not used by LocalGitAPI
            baseUrl: config.baseUrl,
            token: config.token,
            ignoreCertErrors: config.ignoreCertErrors,
            verbose: config.verbose
        };
        const api = new local_1.LocalGitAPI(repoInfo, platformConfig, logger);
        return { platform: types_1.Platform.GITHUB, api }; // Platform is placeholder for local
    }
    const platform = await resolvePlatform(repoInfo, explicitPlatform, logger);
    // Find the provider for the resolved platform
    const provider = platformProviders.find(p => p.type === platform);
    if (!provider) {
        throw new Error(`Unsupported platform: ${platform}`);
    }
    // Collect candidate URLs for base URL determination
    const candidateUrls = await collectCandidateUrls(repoInfo, logger);
    // If explicit baseUrl is provided, prepend it to the array
    const urlsForBaseUrl = config.baseUrl ? [config.baseUrl, ...candidateUrls] : candidateUrls;
    // Determine base URL using the platform's internal function
    let determineBaseUrlFn;
    switch (platform) {
        case types_1.Platform.GITHUB:
            determineBaseUrlFn = github_1.determineBaseUrl;
            break;
        case types_1.Platform.GITEA:
            determineBaseUrlFn = gitea_1.determineBaseUrl;
            break;
        case types_1.Platform.BITBUCKET:
            determineBaseUrlFn = bitbucket_1.determineBaseUrl;
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
    const baseUrl = determineBaseUrlFn(urlsForBaseUrl);
    const platformConfig = {
        type: platform,
        baseUrl,
        token: config.token,
        ignoreCertErrors: config.ignoreCertErrors,
        verbose: config.verbose
    };
    const api = provider.createAPI(repoInfo, platformConfig, logger);
    return { platform, api, baseUrl };
}
//# sourceMappingURL=platform-factory.js.map