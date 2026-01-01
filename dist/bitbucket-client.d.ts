import { ItemInfo } from './types';
/**
 * Get tag information from Bitbucket API
 */
export declare function getTagInfo(tagName: string, owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all tags from Bitbucket repository
 */
export declare function getAllTags(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<Array<{
    name: string;
    date: string;
}>>;
/**
 * Get release information from Bitbucket API
 * Note: Bitbucket doesn't have a dedicated releases API like GitHub/Gitea.
 * Releases in Bitbucket are typically just tags. We'll try to use the tags endpoint
 * and return release-like information if available.
 */
export declare function getReleaseInfo(tagName: string, owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all release names from Bitbucket repository
 * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names
 */
export declare function getAllReleaseNames(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<string[]>;
/**
 * Get all releases from Bitbucket repository with dates
 * Note: Bitbucket doesn't have a dedicated releases API, so we return tag names with dates
 */
export declare function getAllReleases(owner: string, repo: string, token?: string, ignoreCertErrors?: boolean): Promise<Array<{
    name: string;
    date: string;
}>>;
