import { RepositoryInfo } from './types';
import { Logger } from './logger';
/**
 * Parse repository URL or owner/repo format
 */
export declare function parseRepository(repository: string | undefined, logger: Logger): RepositoryInfo | undefined;
/**
 * Get repository info from local Git repository
 */
export declare function getLocalRepositoryInfo(logger: Logger): Promise<RepositoryInfo | undefined>;
/**
 * Get full repository information
 */
export declare function getRepositoryInfo(repository: string | undefined, platform: string | undefined, owner: string | undefined, repo: string | undefined, logger: Logger): Promise<RepositoryInfo>;
/**
 * Encode a value for use as a single path segment in an API URL.
 *
 * Interpolating a value straight into a path lets it redirect the request. Verified against
 * WHATWG URL resolution, which is what both transports in this action apply — they build
 * `new URL(baseUrl + path)` and then send `urlObj.pathname + urlObj.search`:
 *
 *   tag = "../../../user"  ->  /repos/o/r/git/refs/tags/../../../user  =>  /repos/o/user
 *   tag = ".."             ->  /repos/o/r/git/refs/tags/..             =>  /repos/o/r/git/refs/
 *
 * The second is the dangerous one: it reads the whole COLLECTION rather than one item, so
 * the action reports another ref's SHA as the tag the caller asked about.
 *
 * Every interpolated value is attacker-influenceable: tag names come from an action input
 * or a pushed ref, owner/repo are parsed from the user-supplied `repository` input, and
 * SHAs and `tag_name` come back from the forge's own response body.
 *
 * encodeURIComponent is necessary but not sufficient: it does not encode dots, so a bare
 * "." or ".." survives it unchanged and is then removed by dot-segment normalisation. Those
 * two are refused outright rather than encoded, because no legitimate tag, owner, repo or
 * SHA is named "." or "..".
 */
export declare function safeSegment(value: string, label: string): string;
