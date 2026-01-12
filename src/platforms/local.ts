import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, Platform } from '../types';
import { Logger } from '../logger';
import { getTagInfo as getLocalTagInfo, getAllTags as getLocalTags } from '../git-client';

/**
 * Local Git API client
 */
export class LocalGitAPI implements PlatformAPI {
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    if (!repoInfo.path) {
      throw new Error('Local repository path is required');
    }
    this.repoInfo = repoInfo;
    this.logger = logger;
  }

  /**
   * Get tag information
   */
  async getTagInfo(tagName: string): Promise<ItemInfo> {
    if (!this.repoInfo.path) {
      throw new Error('Local repository path is required');
    }
    return getLocalTagInfo(tagName, this.repoInfo.path);
  }

  /**
   * Get release information
   * Releases are not supported for local repositories
   */
  async getReleaseInfo(_tagName: string): Promise<ItemInfo> {
    throw new Error('Releases are not supported for local repositories. Use tag_type: tags or query a remote repository.');
  }

  /**
   * Get all tag names (optimized, no dates)
   */
  async getAllTagNames(): Promise<string[]> {
    if (!this.repoInfo.path) {
      throw new Error('Local repository path is required');
    }
    return getLocalTags(this.repoInfo.path);
  }

  /**
   * Get all tags with dates
   * Note: Local Git doesn't easily provide dates, so we return empty dates
   */
  async getAllTags(): Promise<Array<{ name: string; date: string }>> {
    if (!this.repoInfo.path) {
      throw new Error('Local repository path is required');
    }
    const tags = getLocalTags(this.repoInfo.path);
    // For local tags, we don't have dates easily available, so return empty dates
    return tags.map((name) => ({ name, date: '' }));
  }

  /**
   * Get all release names (optimized, no dates)
   * Releases are not supported for local repositories
   */
  async getAllReleaseNames(): Promise<string[]> {
    throw new Error('Releases are not supported for local repositories');
  }

  /**
   * Get all releases with dates
   * Releases are not supported for local repositories
   */
  async getAllReleases(): Promise<Array<{ name: string; date: string }>> {
    throw new Error('Releases are not supported for local repositories');
  }
}

/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
export function detectFromUrlByHostname(_url: URL): Platform | undefined {
  return undefined;
}

/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
export async function detectFromUrl(_url: URL, _logger: Logger): Promise<Platform | undefined> {
  return undefined;
}

/**
 * Determine base URL for local Git (not applicable)
 */
export function determineBaseUrl(_urls: string | string[]): string | undefined {
  return undefined;
}
