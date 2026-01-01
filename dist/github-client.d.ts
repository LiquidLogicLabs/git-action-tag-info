import { ItemInfo } from './types';
/**
 * Get tag information from GitHub API
 */
export declare function getTagInfo(tagName: string, owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all tag names from GitHub repository (fast, no dates)
 * This is optimized for cases where dates are not needed (e.g., semver sorting)
 * Uses the /repos/{owner}/{repo}/tags endpoint which returns tags in reverse
 * chronological order (newest first), so we can limit to the first page
 * to get the most recent tags.
 */
export declare function getAllTagNames(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean, maxTags?: number): Promise<string[]>;
/**
 * Get all tags from GitHub repository with dates
 * Note: This makes many API calls (1 per tag for commit dates). Consider using getAllTagNames() first
 * if dates are not needed (e.g., for semver sorting).
 * Uses the /repos/{owner}/{repo}/tags endpoint which returns tags sorted by date (newest first),
 * allowing us to limit to the most recent tags.
 */
export declare function getAllTags(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean, maxTags?: number): Promise<Array<{
    name: string;
    date: string;
}>>;
/**
 * Get release information from GitHub API
 */
export declare function getReleaseInfo(tagName: string, owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all release names from GitHub repository
 */
export declare function getAllReleaseNames(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean, maxReleases?: number): Promise<string[]>;
/**
 * Get all releases from GitHub repository with dates
 */
export declare function getAllReleases(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean, maxReleases?: number): Promise<Array<{
    name: string;
    date: string;
}>>;
