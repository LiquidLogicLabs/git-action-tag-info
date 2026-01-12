import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, Platform } from '../types';
import { Logger } from '../logger';
/**
 * Local Git API client
 */
export declare class LocalGitAPI implements PlatformAPI {
    private repoInfo;
    private logger;
    constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger);
    /**
     * Get tag information
     */
    getTagInfo(tagName: string): Promise<ItemInfo>;
    /**
     * Get release information
     * Releases are not supported for local repositories
     */
    getReleaseInfo(_tagName: string): Promise<ItemInfo>;
    /**
     * Get all tag names (optimized, no dates)
     */
    getAllTagNames(): Promise<string[]>;
    /**
     * Get all tags with dates
     * Note: Local Git doesn't easily provide dates, so we return empty dates
     */
    getAllTags(): Promise<Array<{
        name: string;
        date: string;
    }>>;
    /**
     * Get all release names (optimized, no dates)
     * Releases are not supported for local repositories
     */
    getAllReleaseNames(): Promise<string[]>;
    /**
     * Get all releases with dates
     * Releases are not supported for local repositories
     */
    getAllReleases(): Promise<Array<{
        name: string;
        date: string;
    }>>;
}
/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
export declare function detectFromUrlByHostname(_url: URL): Platform | undefined;
/**
 * Detect local Git repository (always returns undefined - handled by repo-utils)
 */
export declare function detectFromUrl(_url: URL, _logger: Logger): Promise<Platform | undefined>;
/**
 * Determine base URL for local Git (not applicable)
 */
export declare function determineBaseUrl(_urls: string | string[]): string | undefined;
//# sourceMappingURL=local.d.ts.map