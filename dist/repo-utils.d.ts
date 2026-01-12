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
