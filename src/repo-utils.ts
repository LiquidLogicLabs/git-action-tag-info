import * as path from 'path';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { RepositoryInfo, Platform } from './types';
import { Logger } from './logger';

/**
 * Parse repository URL or owner/repo format
 */
export function parseRepository(
  repository: string | undefined,
  logger: Logger
): RepositoryInfo | undefined {
  if (!repository) {
    return undefined;
  }

  logger.debug(`Parsing repository: ${repository}`);

  // Check if it's a URL
  const isUrl = repository.startsWith('http://') ||
    repository.startsWith('https://') ||
    repository.startsWith('git@');

  if (isUrl) {
    // Try to parse as URL
    try {
      // Handle git@ URLs by converting to https:// format for parsing
      let urlStr = repository;
      if (repository.startsWith('git@')) {
        // Convert git@host:owner/repo to https://host/owner/repo
        const match = repository.match(/^git@([^:]+):(.+)$/);
        if (match) {
          urlStr = `https://${match[1]}/${match[2]}`;
        }
      }

      const url = new URL(urlStr);

      // Extract owner/repo from path
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1].replace(/\.git$/, '');

        logger.debug(`Parsed URL: ${repository} -> ${owner}/${repo}`);

        return {
          owner,
          repo,
          url: repository,
          platform: 'auto' // Platform detection is handled by the factory
        };
      }
    } catch {
      // Not a valid URL, try owner/repo format
    }
  }

  // Try owner/repo format (e.g., "owner/repo")
  const parts = repository.split('/');
  if (parts.length === 2 && !isUrl) {
    logger.debug(`Parsed as owner/repo format: ${parts[0]}/${parts[1]}`);
    return {
      owner: parts[0],
      repo: parts[1],
      platform: 'auto' // Platform detection is handled by the factory
    };
  }

  // Check if it's a local path
  if (!isUrl) {
    const resolvedPath = path.isAbsolute(repository)
      ? repository
      : path.resolve(process.cwd(), repository);
    
    logger.debug(`Detected local repository path: ${resolvedPath}`);
    return {
      owner: '', // Will be set by getLocalRepositoryInfo if remote exists
      repo: '',
      platform: 'auto',
      path: resolvedPath
    };
  }

  logger.warning(`Could not parse repository format: ${repository}`);
  return undefined;
}

/**
 * Get repository info from local Git repository
 */
export async function getLocalRepositoryInfo(
  logger: Logger
): Promise<RepositoryInfo | undefined> {
  const gitPath = await io.which('git', true);
  if (!gitPath) {
    logger.debug('Git not found in PATH');
    return undefined;
  }

  // Check if we're in a Git repository
  try {
    const exitCode = await exec.exec('git', ['rev-parse', '--git-dir'], {
      silent: true,
      ignoreReturnCode: true
    });

    if (exitCode !== 0) {
      logger.debug('Not in a Git repository');
      return undefined;
    }

    // Get the repository root path
    const output: string[] = [];
    await exec.exec('git', ['rev-parse', '--show-toplevel'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          output.push(data.toString());
        }
      }
    });
    const repoPath = output.join('').trim();

    // Get remote URL - if no remote origin, return local path only
    let remoteUrl = '';
    try {
      const remoteOutput: string[] = [];
      await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            remoteOutput.push(data.toString());
          }
        }
      });
      remoteUrl = remoteOutput.join('').trim();
    } catch {
      logger.debug('No remote origin found, will use local git');
      // No remote origin - return local path info
      return {
        owner: '',
        repo: '',
        platform: 'auto',
        path: repoPath
      };
    }

    // If we have a remote URL, parse it
    if (remoteUrl) {
      const parsed = parseRepository(remoteUrl, logger);
      if (parsed) {
        // Include local path for local operations
        return {
          ...parsed,
          path: repoPath
        };
      }
    }

    // Fallback: return local path only
    return {
      owner: '',
      repo: '',
      platform: 'auto',
      path: repoPath
    };
  } catch (error) {
    logger.debug(`Error checking local repository: ${error}`);
    return undefined;
  }
}

/**
 * Get full repository information
 */
export async function getRepositoryInfo(
  repository: string | undefined,
  platform: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  logger: Logger
): Promise<RepositoryInfo> {
  let repoInfo: RepositoryInfo | undefined;

  // If separate inputs are provided, use them
  if (platform && owner && repo) {
    const platformEnum = platform.toLowerCase() as Platform;
    if (!Object.values(Platform).includes(platformEnum)) {
      throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.values(Platform).join(', ')}`);
    }

    repoInfo = {
      owner,
      repo,
      platform: platformEnum, // Explicit platform, not 'auto'
    };
    logger.debug(`Using separate inputs: ${owner}/${repo} on ${platformEnum}`);
  } else if (repository) {
    // Try to parse provided repository
    repoInfo = parseRepository(repository, logger);
  }

  // If not provided or couldn't parse, try local repository
  if (!repoInfo) {
    repoInfo = await getLocalRepositoryInfo(logger);
  }

  // If still no info, try environment variables as fallback
  if (!repoInfo) {
    // Check Gitea first (since Gitea Actions sets GITHUB_REPOSITORY for compatibility)
    const giteaRepo = process.env.GITEA_REPOSITORY;
    const giteaServerUrl = process.env.GITEA_SERVER_URL || process.env.GITEA_API_URL;
    const githubServerUrl = process.env.GITHUB_SERVER_URL;
    
    if (giteaRepo) {
      const [owner, repo] = giteaRepo.split('/');
      repoInfo = {
        owner,
        repo,
        platform: 'auto' // Platform detection is handled by the factory
      };
      logger.debug(`Using GITEA_REPOSITORY: ${owner}/${repo}`);
    } else if (giteaServerUrl || (githubServerUrl && !githubServerUrl.includes('github.com'))) {
      // Gitea server URL or GITHUB_SERVER_URL set to non-GitHub URL indicates Gitea
      const githubRepo = process.env.GITHUB_REPOSITORY;
      if (githubRepo) {
        const [owner, repo] = githubRepo.split('/');
        repoInfo = {
          owner,
          repo,
          platform: 'auto' // Platform detection is handled by the factory
        };
        logger.debug(`Using GITHUB_REPOSITORY with Gitea server URL: ${owner}/${repo}`);
      }
    } else if (process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      repoInfo = {
        owner,
        repo,
        platform: Platform.GITHUB, // GitHub Actions context
      };
      logger.debug(`Using GITHUB_REPOSITORY: ${owner}/${repo}`);
    }
  }

  // If we still don't have info, throw error
  if (!repoInfo) {
    throw new Error(
      'Could not determine repository information. Please provide repository input or run in a Git repository.'
    );
  }

  logger.info(`Repository: ${repoInfo.owner || 'local'}/${repoInfo.repo || repoInfo.path || 'unknown'}`);

  return repoInfo;
}
