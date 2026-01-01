import { ItemInfo } from './types';
/**
 * Get all tags from repository
 */
export declare function getAllTags(repoPath: string): string[];
/**
 * Get tag information from local repository
 */
export declare function getTagInfo(tagName: string, repoPath: string): ItemInfo;
