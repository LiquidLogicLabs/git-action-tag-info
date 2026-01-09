import * as core from '@actions/core';
import { ItemInfo, RepoConfig } from './types';
import { detectRepository } from './repo-detector';
import { getTagInfo as getLocalTagInfo } from './git-client';
import { getTagInfo as getGithubTagInfo, getReleaseInfo as getGithubReleaseInfo } from './github-client';
import { getTagInfo as getGiteaTagInfo, getReleaseInfo as getGiteaReleaseInfo } from './gitea-client';
import { getTagInfo as getBitbucketTagInfo, getReleaseInfo as getBitbucketReleaseInfo } from './bitbucket-client';
import { resolveLatestTag } from './tag-resolver';
import { Platform } from './types';
import { parseTagFormat } from './format-parser';
import { Logger } from './logger';

/**
 * Get item information (tag or release) based on repository configuration
 */
async function getItemInfoFromRepo(
  tagName: string,
  config: RepoConfig,
  itemType: 'tags' | 'release'
): Promise<ItemInfo> {
  // Validate: releases are not supported for local repositories
  if (itemType === 'release' && config.type === 'local') {
    throw new Error('Releases are not supported for local repositories. Use tag_type: tags or query a remote repository.');
  }

  if (config.type === 'local') {
    if (!config.path) {
      throw new Error('Local repository path is required');
    }
    if (itemType === 'release') {
      throw new Error('Releases are not supported for local repositories');
    }
    return getLocalTagInfo(tagName, config.path);
  }

  if (config.type === 'remote') {
    if (!config.platform || !config.owner || !config.repo) {
      throw new Error('Remote repository configuration is incomplete');
    }

    if (itemType === 'release') {
      // Route to release functions
      switch (config.platform) {
        case Platform.GITHUB:
          return await getGithubReleaseInfo(
            tagName,
            config.owner,
            config.repo,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.GITEA:
          if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
          }
          return await getGiteaReleaseInfo(
            tagName,
            config.owner,
            config.repo,
            config.baseUrl,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.BITBUCKET:
          return await getBitbucketReleaseInfo(
            tagName,
            config.owner,
            config.repo,
            config.token,
            config.ignoreCertErrors
          );
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
    } else {
      // Route to tag functions
      switch (config.platform) {
        case Platform.GITHUB:
          return await getGithubTagInfo(
            tagName,
            config.owner,
            config.repo,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.GITEA:
          if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
          }
          return await getGiteaTagInfo(
            tagName,
            config.owner,
            config.repo,
            config.baseUrl,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.BITBUCKET:
          return await getBitbucketTagInfo(
            tagName,
            config.owner,
            config.repo,
            config.token,
            config.ignoreCertErrors
          );
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
    }
  }

  throw new Error('Invalid repository configuration');
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Read inputs
    const tagName = core.getInput('tag_name', { required: true });
    const tagType = core.getInput('tag_type') || 'tags'; // Default to 'tags'
    const repository = core.getInput('repository');
    const platform = core.getInput('platform');
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    const baseUrl = core.getInput('base_url');
    // Fallback to GITHUB_TOKEN if custom token is not provided
    const token = core.getInput('token') || process.env.GITHUB_TOKEN;
    const ignoreCertErrors = core.getBooleanInput('ignore_cert_errors');
    const tagFormatInput = core.getInput('tag_format') || undefined;
    const tagFormat = parseTagFormat(tagFormatInput);
    const verbose = core.getBooleanInput('verbose');
    const logger = new Logger(verbose);

    // Validate tag_type input
    if (tagType !== 'tags' && tagType !== 'release') {
      throw new Error(`Invalid tag_type: ${tagType}. Must be 'tags' or 'release'`);
    }

    // Warn if certificate errors are being ignored (security risk)
    if (ignoreCertErrors) {
      logger.warning(
        'SSL certificate validation is disabled. This is a security risk and should only be used with self-hosted instances with self-signed certificates.'
      );
    }

    // Mask token in logs
    if (token) {
      core.setSecret(token);
    }

    // Detect repository configuration
    logger.info('Detecting repository configuration...');
    const repoConfig = detectRepository(
      repository,
      platform,
      owner,
      repo,
      baseUrl,
      token,
      ignoreCertErrors
    );

    logger.info(`Repository type: ${repoConfig.type}, Platform: ${repoConfig.platform || 'N/A'}, Item type: ${tagType}`);

    // Resolve "latest" tag/release if needed
    let resolvedTagName = tagName;
    if (tagName.toLowerCase() === 'latest') {
      const itemTypeLabel = tagType === 'release' ? 'release' : 'tag';
      logger.info(`Resolving latest ${itemTypeLabel}...`);
      resolvedTagName = await resolveLatestTag(repoConfig, tagFormat, tagType);
      logger.info(`Resolved latest ${itemTypeLabel}: ${resolvedTagName}`);
    }

    // Get item information (tag or release)
    const itemTypeLabel = tagType === 'release' ? 'release' : 'tag';
    logger.info(`Fetching ${itemTypeLabel} information for: ${resolvedTagName}`);
    const itemInfo = await getItemInfoFromRepo(resolvedTagName, repoConfig, tagType);

    // Set outputs with normalized field names
    core.setOutput('exists', itemInfo.exists.toString());
    core.setOutput('name', itemInfo.name);
    core.setOutput('item_sha', itemInfo.item_sha);
    core.setOutput('item_type', itemInfo.item_type);
    core.setOutput('commit_sha', itemInfo.commit_sha);
    core.setOutput('details', itemInfo.details);
    core.setOutput('verified', itemInfo.verified.toString());
    core.setOutput('is_draft', itemInfo.is_draft.toString());
    core.setOutput('is_prerelease', itemInfo.is_prerelease.toString());

    if (!itemInfo.exists) {
      logger.warning(
        `${itemTypeLabel.charAt(0).toUpperCase() + itemTypeLabel.slice(1)} "${resolvedTagName}" does not exist in the repository`
      );
    } else {
      logger.info(
        `${itemTypeLabel.charAt(0).toUpperCase() + itemTypeLabel.slice(1)} "${resolvedTagName}" found successfully`
      );
      logger.debug(`Name: ${itemInfo.name}`);
      logger.debug(`SHA: ${itemInfo.item_sha}`);
      logger.debug(`Type: ${itemInfo.item_type}`);
      logger.debug(`Commit: ${itemInfo.commit_sha}`);
      if (itemInfo.details) {
        logger.debug(`Details: ${itemInfo.details.substring(0, 100)}...`);
      }
      if (tagType === 'release') {
        logger.debug(`Draft: ${itemInfo.is_draft}`);
        logger.debug(`Prerelease: ${itemInfo.is_prerelease}`);
      }
      if (tagType === 'tags' && itemInfo.verified) {
        logger.debug(`Verified: ${itemInfo.verified}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

// Run the action
run();

