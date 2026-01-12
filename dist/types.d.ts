/**
 * Supported Git hosting platforms
 */
export declare enum Platform {
    GITHUB = "github",
    GITEA = "gitea",
    BITBUCKET = "bitbucket"
}
/**
 * Item type enumeration
 */
export declare enum ItemType {
    COMMIT = "commit",// Lightweight tag
    TAG = "tag",// Annotated tag
    RELEASE = "release"
}
/**
 * Tag type enumeration (deprecated - use ItemType)
 * @deprecated Use ItemType instead. TagType.COMMIT maps to ItemType.COMMIT, TagType.ANNOTATED maps to ItemType.TAG.
 */
export declare enum TagType {
    COMMIT = "commit",
    ANNOTATED = "annotated"
}
/**
 * Item information structure (unified for tags and releases)
 */
export interface ItemInfo {
    exists: boolean;
    name: string;
    item_sha: string;
    item_type: ItemType;
    commit_sha: string;
    details: string;
    verified: boolean;
    is_draft: boolean;
    is_prerelease: boolean;
}
/**
 * Tag information structure (deprecated - use ItemInfo)
 * @deprecated Use ItemInfo instead. Kept as alias for backward compatibility.
 */
export type TagInfo = ItemInfo;
/**
 * Repository configuration
 */
export interface RepoConfig {
    type: 'local' | 'remote';
    platform?: Platform;
    owner?: string;
    repo?: string;
    baseUrl?: string;
    path?: string;
    token?: string;
    ignoreCertErrors?: boolean;
    tagFormat?: string;
}
/**
 * HTTP response structure for API calls
 */
export interface HttpResponse {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
}
/**
 * Platform API interface for tag and release operations
 */
export interface PlatformAPI {
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
 * Platform configuration
 */
export interface PlatformConfig {
    type: Platform;
    baseUrl?: string;
    token?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
}
/**
 * Repository information for factory pattern
 */
export interface RepositoryInfo {
    owner: string;
    repo: string;
    url?: string;
    platform: Platform | 'auto';
    path?: string;
}
