import { ItemInfo } from './types';
/**
 * Get tag information from Gitea API
 */
export declare function getTagInfo(tagName: string, owner: string, repo: string, baseUrl: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all tags from Gitea repository
 */
export declare function getAllTags(owner: string, repo: string, baseUrl: string, token?: string, ignoreCertErrors?: boolean): Promise<Array<{
    name: string;
    date: string;
}>>;
/**
 * Get release information from Gitea API
 */
export declare function getReleaseInfo(tagName: string, owner: string, repo: string, baseUrl: string, token?: string, ignoreCertErrors?: boolean): Promise<ItemInfo>;
/**
 * Get all release names from Gitea repository
 */
export declare function getAllReleaseNames(owner: string, repo: string, baseUrl: string, token?: string, ignoreCertErrors?: boolean): Promise<string[]>;
/**
 * Get all releases from Gitea repository with dates
 */
export declare function getAllReleases(owner: string, repo: string, baseUrl: string, token?: string, ignoreCertErrors?: boolean): Promise<Array<{
    name: string;
    date: string;
}>>;
