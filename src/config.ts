import * as core from '@actions/core';
import { Platform } from './types';
import { parseTagFormat } from './format-parser';

/**
 * Action inputs interface
 */
export interface ActionInputs {
  tagName: string;
  tagType: 'tags' | 'release';
  repository?: string;
  platform?: string;
  owner?: string;
  repo?: string;
  baseUrl?: string;
  token?: string;
  ignoreCertErrors: boolean;
  tagFormat?: string[];
  verbose: boolean;
  debugMode: boolean;
}

/**
 * Parse boolean input with default value
 */
function getBooleanInput(name: string, defaultValue: boolean = false): boolean {
  const value = core.getInput(name);
  if (value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

/**
 * Get optional string input
 */
function getOptionalInput(name: string): string | undefined {
  const value = core.getInput(name);
  return value === '' ? undefined : value;
}

/**
 * Get and validate action inputs
 */
export function getInputs(): ActionInputs {
  const tagName = core.getInput('tag-name', { required: true });
  if (!tagName || tagName.trim() === '') {
    throw new Error('tag-name is required and cannot be empty');
  }

  const tagTypeInput = core.getInput('tag-type') || 'tags';
  if (tagTypeInput !== 'tags' && tagTypeInput !== 'release') {
    throw new Error(`Invalid tagType: ${tagTypeInput}. Must be 'tags' or 'release'`);
  }
  const tagType = tagTypeInput as 'tags' | 'release';

  const repository = getOptionalInput('repository');
  const platform = getOptionalInput('platform') || getOptionalInput('repo-type');
  const owner = getOptionalInput('owner');
  const repo = getOptionalInput('repo');
  const baseUrl = getOptionalInput('base-url');
  const token = getOptionalInput('token');
  const ignoreCertErrors = getBooleanInput('skip-certificate-check', false);
  const tagFormatInput = getOptionalInput('tag-format');
  const tagFormat = parseTagFormat(tagFormatInput);
  const verboseInput = getBooleanInput('verbose', false);

  function parseBoolean(val?: string): boolean {
    return val?.toLowerCase() === 'true' || val === '1';
  }
  const debugMode =
    (typeof core.isDebug === 'function' && core.isDebug()) ||
    parseBoolean(process.env.ACTIONS_STEP_DEBUG) ||
    parseBoolean(process.env.ACTIONS_RUNNER_DEBUG) ||
    parseBoolean(process.env.RUNNER_DEBUG);
  const verbose = verboseInput || debugMode;

  // Validate base URL format if provided
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid baseUrl format: ${baseUrl}`);
    }
  }

  return {
    tagName: tagName.trim(),
    tagType,
    repository: repository?.trim(),
    platform: platform?.trim(),
    owner: owner?.trim(),
    repo: repo?.trim(),
    baseUrl: baseUrl?.trim(),
    token: token?.trim() || undefined,
    ignoreCertErrors,
    tagFormat,
    verbose,
    debugMode,
  };
}

/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
export function resolveToken(token: string | undefined, platform: Platform | 'auto'): string | undefined {
  // If token is explicitly provided, use it
  if (token) {
    return token;
  }

  // Otherwise, try platform-specific environment variables
  switch (platform) {
    case Platform.GITHUB:
      return process.env.GITHUB_TOKEN;
    case Platform.GITEA:
      return process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN; // Gitea Actions also provides GITHUB_TOKEN
    case Platform.BITBUCKET:
      return process.env.BITBUCKET_TOKEN;
    case 'auto':
    default:
      // For auto or unknown, try common token environment variables
      return (
        process.env.GITHUB_TOKEN ||
        process.env.GITEA_TOKEN ||
        process.env.BITBUCKET_TOKEN
      );
  }
}
