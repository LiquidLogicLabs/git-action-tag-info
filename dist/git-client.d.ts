import { ItemInfo } from './types';
/**
 * Reject a value git would read as an option rather than as data.
 *
 * Passing arguments as an array stops the SHELL interpreting them, but git still parses a
 * leading "-" as an option, and some of those options run commands — `--upload-pack=<cmd>`
 * being the obvious one. Refnames beginning with "-" are legal as far as
 * `git check-ref-format` is concerned, so this has to be checked rather than assumed.
 */
export declare function assertNotOptionLike(value: string, label: string): void;
/**
 * Get all tags from repository
 */
export declare function getAllTags(repoPath: string): string[];
/**
 * Get tag information from local repository
 */
export declare function getTagInfo(tagName: string, repoPath: string): ItemInfo;
