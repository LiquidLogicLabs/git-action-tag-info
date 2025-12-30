import * as core from '@actions/core';
import { TagInfo, RepoConfig } from './types';
import { detectRepository } from './repo-detector';
import { getTagInfo as getLocalTagInfo } from './git-client';
import { getTagInfo as getGithubTagInfo } from './github-client';
import { getTagInfo as getGiteaTagInfo } from './gitea-client';
import { getTagInfo as getBitbucketTagInfo } from './bitbucket-client';
import { resolveLatestTag } from './tag-resolver';
import { Platform } from './types';

/**
 * Get tag information based on repository configuration
 */
async function getTagInfoFromRepo(
  tagName: string,
  config: RepoConfig
): Promise<TagInfo> {
  if (config.type === 'local') {
    if (!config.path) {
      throw new Error('Local repository path is required');
    }
    return getLocalTagInfo(tagName, config.path);
  }

  if (config.type === 'remote') {
    if (!config.platform || !config.owner || !config.repo) {
      throw new Error('Remote repository configuration is incomplete');
    }

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

  throw new Error('Invalid repository configuration');
}

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Read inputs
    const tagName = core.getInput('tag_name', { required: true });
    const repository = core.getInput('repository');
    const platform = core.getInput('platform');
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    const baseUrl = core.getInput('base_url');
    // Fallback to GITHUB_TOKEN if custom token is not provided
    const token = core.getInput('token') || process.env.GITHUB_TOKEN;
    const ignoreCertErrors = core.getBooleanInput('ignore_cert_errors');
    const tagFormat = core.getInput('tag_format') || undefined;

    // Warn if certificate errors are being ignored (security risk)
    if (ignoreCertErrors) {
      core.warning(
        'SSL certificate validation is disabled. This is a security risk and should only be used with self-hosted instances with self-signed certificates.'
      );
    }

    // Mask token in logs
    if (token) {
      core.setSecret(token);
    }

    // Detect repository configuration
    core.info('Detecting repository configuration...');
    const repoConfig = detectRepository(
      repository,
      platform,
      owner,
      repo,
      baseUrl,
      token,
      ignoreCertErrors
    );

    core.info(
      `Repository type: ${repoConfig.type}, Platform: ${repoConfig.platform || 'N/A'}`
    );

    // Resolve "latest" tag if needed
    let resolvedTagName = tagName;
    if (tagName.toLowerCase() === 'latest') {
      core.info('Resolving latest tag...');
      resolvedTagName = await resolveLatestTag(repoConfig, tagFormat);
      core.info(`Resolved latest tag: ${resolvedTagName}`);
    }

    // Get tag information
    core.info(`Fetching tag information for: ${resolvedTagName}`);
    const tagInfo = await getTagInfoFromRepo(resolvedTagName, repoConfig);

    // Set outputs
    core.setOutput('exists', tagInfo.exists.toString());
    core.setOutput('tag_name', tagInfo.tag_name);
    core.setOutput('tag_sha', tagInfo.tag_sha);
    core.setOutput('tag_type', tagInfo.tag_type);
    core.setOutput('commit_sha', tagInfo.commit_sha);
    core.setOutput('tag_message', tagInfo.tag_message);
    core.setOutput('verified', tagInfo.verified.toString());

    if (!tagInfo.exists) {
      core.warning(`Tag "${resolvedTagName}" does not exist in the repository`);
    } else {
      core.info(`Tag "${resolvedTagName}" found successfully`);
      core.info(`  SHA: ${tagInfo.tag_sha}`);
      core.info(`  Type: ${tagInfo.tag_type}`);
      core.info(`  Commit: ${tagInfo.commit_sha}`);
      if (tagInfo.tag_message) {
        core.info(`  Message: ${tagInfo.tag_message.substring(0, 100)}...`);
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

