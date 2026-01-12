import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, Platform } from '../types';
import { Logger } from '../logger';
/**
 * GitHub API client
 */
export declare class GitHubAPI implements PlatformAPI {
    private octokit;
    private repoInfo;
    private logger;
    constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger);
    /**
     * Get tag information
     */
    getTagInfo(tagName: string): Promise<ItemInfo>;
    /**
     * Get release information
     */
    getReleaseInfo(tagName: string): Promise<ItemInfo>;
    /**
     * Get all tag names (optimized, no dates)
     */
    getAllTagNames(): Promise<string[]>;
    /**
     * Get all tags with dates
     */
    getAllTags(): Promise<Array<{
        name: string;
        date: string;
    }>>;
    /**
     * Get all release names (optimized, no dates)
     */
    getAllReleaseNames(): Promise<string[]>;
    /**
     * Get all releases with dates
     */
    getAllReleases(): Promise<Array<{
        name: string;
        date: string;
    }>>;
}
/**
 * Detect GitHub from URL hostname
 */
export declare function detectFromUrlByHostname(url: URL): Platform | undefined;
export declare function detectFromUrl(url: URL, logger: Logger): Promise<Platform | undefined>;
/**
 * Determine base URL for GitHub API
 */
export declare function determineBaseUrl(urls: string | string[]): string | undefined;
//# sourceMappingURL=github.d.ts.map