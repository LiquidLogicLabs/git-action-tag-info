import { PlatformAPI, RepositoryInfo, PlatformConfig, ItemInfo, Platform } from '../types';
import { Logger } from '../logger';
/**
 * Bitbucket API client
 */
export declare class BitbucketAPI implements PlatformAPI {
    private repoInfo;
    private config;
    private logger;
    private baseUrl;
    constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger);
    /**
     * Get tag information
     */
    getTagInfo(tagName: string): Promise<ItemInfo>;
    /**
     * Get release information
     * Note: Bitbucket doesn't have a dedicated releases API like GitHub/Gitea.
     * Releases in Bitbucket are typically just tags. We'll use the tags endpoint
     * and return release-like information.
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
     * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names
     */
    getAllReleaseNames(): Promise<string[]>;
    /**
     * Get all releases with dates
     * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names with dates
     */
    getAllReleases(): Promise<Array<{
        name: string;
        date: string;
    }>>;
}
/**
 * Detect Bitbucket from URL hostname
 */
export declare function detectFromUrlByHostname(url: URL): Platform | undefined;
export declare function detectFromUrl(url: URL, logger: Logger): Promise<Platform | undefined>;
/**
 * Determine base URL for Bitbucket API
 */
export declare function determineBaseUrl(urls: string | string[]): string | undefined;
//# sourceMappingURL=bitbucket.d.ts.map