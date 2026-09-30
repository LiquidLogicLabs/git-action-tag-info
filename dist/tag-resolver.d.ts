import { PlatformAPI, ReleaseSummary } from './types';
/**
 * Resolve "latest" item name (tag or release)
 * Strategy: Try semver first (using fast name-only fetch when available), then fallback to date
 * If tagFormat is provided, filter items by format before sorting
 * If tagFormat is an array, try each pattern in order as fallbacks
 */
export declare function resolveLatestTag(platformAPI: PlatformAPI, tagFormat?: string | string[], itemType?: 'tags' | 'release', includePrereleases?: boolean): Promise<string>;
/**
 * Drop releases that are not candidates for "latest".
 *
 * A draft is unpublished, so it is never a candidate. A prerelease is only a
 * candidate when the caller asks for one. This mirrors what GitHub's own
 * /releases/latest endpoint does, and without it a project that publishes a
 * prerelease line in parallel with its stable line (n8n ships 2.40.x betas
 * alongside 2.39.x) resolves "latest" to the prerelease.
 */
export declare function filterPublishedReleases(releases: ReleaseSummary[], includePrereleases: boolean): ReleaseSummary[];
