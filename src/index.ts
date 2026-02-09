import * as core from '@actions/core';
import { ItemInfo, Platform } from './types';
import { getInputs, resolveToken } from './config';
import { getRepositoryInfo } from './repo-utils';
import { createPlatformAPI } from './platforms/platform-factory';
import { resolveLatestTag } from './tag-resolver';
import { Logger } from './logger';

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Get and validate inputs
    const inputs = getInputs();
    const logger = new Logger(inputs.verbose, inputs.debugMode);
    const shortSha = (value?: string): string => (value ? value.substring(0, 7) : '');

    // Warn if certificate errors are being ignored (security risk)
    if (inputs.ignoreCertErrors) {
      logger.warning(
        'SSL certificate validation is disabled. This is a security risk and should only be used with self-hosted instances with self-signed certificates.'
      );
    }

    // Mask token in logs
    if (inputs.token) {
      core.setSecret(inputs.token);
    }

    // Get repository information
    logger.info('Detecting repository configuration...');
    const repoInfo = await getRepositoryInfo(
      inputs.repository,
      inputs.platform,
      inputs.owner,
      inputs.repo,
      logger
    );

    // Resolve token based on detected platform
    const resolvedToken = resolveToken(inputs.token, repoInfo.platform);

    // Create platform API instance
    const { platform, api: platformAPI } = await createPlatformAPI(
      repoInfo,
      inputs.platform ? (inputs.platform.toLowerCase() as Platform) : 'auto',
      {
        token: resolvedToken,
        baseUrl: inputs.baseUrl,
        ignoreCertErrors: inputs.ignoreCertErrors,
        verbose: inputs.verbose
      },
      logger
    );

    logger.info(`Repository: ${repoInfo.owner || 'local'}/${repoInfo.repo || repoInfo.path || 'unknown'}, Platform: ${platform}, Item type: ${inputs.tagType}`);

    // Resolve "latest" tag/release if needed
    let resolvedTagName = inputs.tagName;
    if (inputs.tagName.toLowerCase() === 'latest') {
      const itemTypeLabel = inputs.tagType === 'release' ? 'release' : 'tag';
      logger.info(`Resolving latest ${itemTypeLabel}...`);
      resolvedTagName = await resolveLatestTag(platformAPI, inputs.tagFormat, inputs.tagType);
      logger.info(`Resolved latest ${itemTypeLabel}: ${resolvedTagName}`);
    }

    // Get item information (tag or release)
    const itemTypeLabel = inputs.tagType === 'release' ? 'release' : 'tag';
    logger.info(`Fetching ${itemTypeLabel} information for: ${resolvedTagName}`);
    const itemInfo = inputs.tagType === 'release'
      ? await platformAPI.getReleaseInfo(resolvedTagName)
      : await platformAPI.getTagInfo(resolvedTagName);

    // Set outputs with normalized field names
    core.setOutput('exists', itemInfo.exists.toString());
    core.setOutput('name', itemInfo.name);
    core.setOutput('item-sha', itemInfo.item_sha);
    core.setOutput('item-sha-short', shortSha(itemInfo.item_sha));
    core.setOutput('item-type', itemInfo.item_type);
    core.setOutput('commit-sha', itemInfo.commit_sha);
    core.setOutput('commit-sha-short', shortSha(itemInfo.commit_sha));
    core.setOutput('details', itemInfo.details);
    core.setOutput('verified', itemInfo.verified.toString());
    core.setOutput('is-draft', itemInfo.is_draft.toString());
    core.setOutput('is-prerelease', itemInfo.is_prerelease.toString());

    if (!itemInfo.exists) {
      logger.warning(
        `${itemTypeLabel.charAt(0).toUpperCase() + itemTypeLabel.slice(1)} "${resolvedTagName}" does not exist in the repository`
      );
    } else {
      logger.info(
        `${itemTypeLabel.charAt(0).toUpperCase() + itemTypeLabel.slice(1)} "${resolvedTagName}" found successfully`
      );
      logger.verboseInfo(`name: ${itemInfo.name}`);
      logger.verboseInfo(`item-sha: ${itemInfo.item_sha}`);
      logger.verboseInfo(`item-type: ${itemInfo.item_type}`);
      logger.verboseInfo(`commit-sha: ${itemInfo.commit_sha}`);
      if (itemInfo.details) {
        logger.debug(`details: ${itemInfo.details.substring(0, 100)}...`);
      }
      if (inputs.tagType === 'release') {
        logger.verboseInfo(`is-draft: ${itemInfo.is_draft}`);
        logger.verboseInfo(`is-prerelease: ${itemInfo.is_prerelease}`);
      }
      if (inputs.tagType === 'tags' && itemInfo.verified) {
        logger.verboseInfo(`verified: ${itemInfo.verified}`);
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

