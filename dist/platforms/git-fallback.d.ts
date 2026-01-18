import { ItemInfo } from '../types';
import { Logger } from '../logger';
/**
 * Try to get tag information using git ls-remote as a fallback when API fails
 * This is platform-agnostic and works with any git repository
 *
 * @param tagName - The tag name to look up
 * @param repoUrl - The repository URL (will be normalized)
 * @param logger - Logger instance for debug output
 * @returns ItemInfo if tag found, null if not found or fallback failed
 */
export declare function tryGitLsRemoteFallback(tagName: string, repoUrl: string | undefined, logger: Logger): ItemInfo | null;
//# sourceMappingURL=git-fallback.d.ts.map