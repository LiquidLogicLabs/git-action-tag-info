import * as exec from '@actions/exec';
import { Platform, RepositoryInfo, PlatformAPI, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { GitHubAPI, detectFromUrlByHostname as detectGithubFromUrlByHostname, detectFromUrl as detectGithubFromUrl, determineBaseUrl as determineGithubBaseUrl } from './github';
import { GiteaAPI, detectFromUrlByHostname as detectGiteaFromUrlByHostname, detectFromUrl as detectGiteaFromUrl, determineBaseUrl as determineGiteaBaseUrl } from './gitea';
import { BitbucketAPI, detectFromUrlByHostname as detectBitbucketFromUrlByHostname, detectFromUrl as detectBitbucketFromUrl, determineBaseUrl as determineBitbucketBaseUrl } from './bitbucket';
import { LocalGitAPI } from './local';

interface PlatformProvider {
  type: Platform;
  detectFromUrlByHostname: (url: URL) => Platform | undefined;
  detectFromUrl: (url: URL, logger: Logger) => Promise<Platform | undefined>;
  createAPI: (repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) => PlatformAPI;
}

const platformProviders: PlatformProvider[] = [
  {
    type: Platform.GITEA,
    detectFromUrlByHostname: detectGiteaFromUrlByHostname,
    detectFromUrl: detectGiteaFromUrl,
    createAPI: (repoInfo, config, logger) => new GiteaAPI(repoInfo, config, logger)
  },
  {
    type: Platform.GITHUB,
    detectFromUrlByHostname: detectGithubFromUrlByHostname,
    detectFromUrl: detectGithubFromUrl,
    createAPI: (repoInfo, config, logger) => new GitHubAPI(repoInfo, config, logger)
  },
  {
    type: Platform.BITBUCKET,
    detectFromUrlByHostname: detectBitbucketFromUrlByHostname,
    detectFromUrl: detectBitbucketFromUrl,
    createAPI: (repoInfo, config, logger) => new BitbucketAPI(repoInfo, config, logger)
  }
];

/**
 * Collect candidate URLs from repository URL, origin URL, and environment variables
 */
async function collectCandidateUrls(repoInfo: RepositoryInfo, logger: Logger): Promise<string[]> {
  const urls: string[] = [];

  // Add repository URL if available
  if (repoInfo.url) {
    urls.push(repoInfo.url);
  }

  // Try to get origin URL from git
  try {
    const output: string[] = [];
    await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
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
  } catch {
    // Git not available or no origin - skip
  }

  // Add environment variable URLs
  const envUrls = [
    process.env.GITHUB_SERVER_URL,
    process.env.GITEA_SERVER_URL,
    process.env.GITEA_API_URL
  ].filter((url): url is string => !!url);

  for (const envUrl of envUrls) {
    if (!urls.includes(envUrl)) {
      urls.push(envUrl);
      logger.debug(`Added environment URL: ${envUrl}`);
    }
  }

  return urls;
}

async function resolvePlatform(
  repoInfo: RepositoryInfo,
  explicitPlatform: Platform | 'auto' | undefined,
  logger: Logger
): Promise<Platform> {
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
    return Platform.GITHUB; // Placeholder, LocalGitAPI will be used
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
    } catch {
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
    } catch {
      logger.debug(`Could not parse URL for detector probes: ${urlStr}`);
    }
  }

  // Default to GitHub if we have owner/repo but couldn't detect
  if (repoInfo.owner && repoInfo.repo) {
    logger.debug('Could not detect platform, defaulting to GitHub');
    return Platform.GITHUB;
  }

  // If we have a local path, we'll use LocalGitAPI (handled in createPlatformAPI)
  logger.debug('Could not detect platform, will use LocalGitAPI if path is available');
  return Platform.GITHUB; // Placeholder
}

export async function createPlatformAPI(
  repoInfo: RepositoryInfo,
  explicitPlatform: Platform | 'auto' | undefined,
  config: {
    token?: string;
    baseUrl?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
  },
  logger: Logger
): Promise<{ platform: Platform; api: PlatformAPI; baseUrl?: string }> {
  // Check if this is a local-only repository (has path but no owner/repo)
  if (repoInfo.path && (!repoInfo.owner || !repoInfo.repo)) {
    // Use LocalGitAPI for local repositories
    const platformConfig: PlatformConfig = {
      type: Platform.GITHUB, // Placeholder, not used by LocalGitAPI
      baseUrl: config.baseUrl,
      token: config.token,
      ignoreCertErrors: config.ignoreCertErrors,
      verbose: config.verbose
    };
    const api = new LocalGitAPI(repoInfo, platformConfig, logger);
    return { platform: Platform.GITHUB, api }; // Platform is placeholder for local
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
  let determineBaseUrlFn: (urls: string | string[]) => string | undefined;
  switch (platform) {
    case Platform.GITHUB:
      determineBaseUrlFn = determineGithubBaseUrl;
      break;
    case Platform.GITEA:
      determineBaseUrlFn = determineGiteaBaseUrl;
      break;
    case Platform.BITBUCKET:
      determineBaseUrlFn = determineBitbucketBaseUrl;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  const baseUrl = determineBaseUrlFn(urlsForBaseUrl);

  const platformConfig: PlatformConfig = {
    type: platform,
    baseUrl,
    token: config.token,
    ignoreCertErrors: config.ignoreCertErrors,
    verbose: config.verbose
  };

  const api = provider.createAPI(repoInfo, platformConfig, logger);

  return { platform, api, baseUrl };
}
