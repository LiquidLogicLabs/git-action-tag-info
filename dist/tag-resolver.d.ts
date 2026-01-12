import { PlatformAPI } from './types';
/**
 * Resolve "latest" item name (tag or release)
 * Strategy: Try semver first (using fast name-only fetch when available), then fallback to date
 * If tagFormat is provided, filter items by format before sorting
 * If tagFormat is an array, try each pattern in order as fallbacks
 */
export declare function resolveLatestTag(platformAPI: PlatformAPI, tagFormat?: string | string[], itemType?: 'tags' | 'release'): Promise<string>;
