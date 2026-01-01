import * as core from '@actions/core';
import { RepoConfig, Platform } from './types';
import { getAllTags as getLocalTags } from './git-client';
import { getAllTags as getGithubTags, getAllTagNames as getGithubTagNames, getAllReleaseNames as getGithubReleaseNames, getAllReleases as getGithubReleases } from './github-client';
import { getAllTags as getGiteaTags, getAllReleaseNames as getGiteaReleaseNames, getAllReleases as getGiteaReleases } from './gitea-client';
import { getAllTags as getBitbucketTags, getAllReleaseNames as getBitbucketReleaseNames, getAllReleases as getBitbucketReleases } from './bitbucket-client';
import { isSemver, sortTagsBySemver, compareSemver } from './semver';
import { filterTagsByFormat, matchTagFormat } from './format-matcher';

/**
 * Get all items (tags or releases) from repository based on configuration
 */
async function getAllItemsFromRepo(
  config: RepoConfig,
  itemType: 'tags' | 'release'
): Promise<Array<{ name: string; date: string }>> {
  // Releases are not supported for local repositories
  if (itemType === 'release' && config.type === 'local') {
    throw new Error('Releases are not supported for local repositories');
  }

  if (config.type === 'local') {
    if (!config.path) {
      throw new Error('Local repository path is required');
    }
    if (itemType === 'release') {
      throw new Error('Releases are not supported for local repositories');
    }
    const tags = getLocalTags(config.path);
    // For local tags, we don't have dates easily available, so return empty dates
    return tags.map((name) => ({ name, date: '' }));
  }

  if (config.type === 'remote') {
    if (!config.platform || !config.owner || !config.repo) {
      throw new Error('Remote repository configuration is incomplete');
    }

    if (itemType === 'release') {
      // Route to release listing functions
      switch (config.platform) {
        case Platform.GITHUB:
          return await getGithubReleases(config.owner, config.repo, config.token, config.ignoreCertErrors);
        case Platform.GITEA:
          if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
          }
          return await getGiteaReleases(
            config.owner,
            config.repo,
            config.baseUrl,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.BITBUCKET:
          return await getBitbucketReleases(config.owner, config.repo, config.token, config.ignoreCertErrors);
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
    } else {
      // Route to tag listing functions
      switch (config.platform) {
        case Platform.GITHUB:
          return await getGithubTags(config.owner, config.repo, config.token, config.ignoreCertErrors);
        case Platform.GITEA:
          if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
          }
          return await getGiteaTags(
            config.owner,
            config.repo,
            config.baseUrl,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.BITBUCKET:
          return await getBitbucketTags(config.owner, config.repo, config.token, config.ignoreCertErrors);
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
    }
  }

  throw new Error('Invalid repository configuration');
}

/**
 * Get all item names (tags or releases) from repository (optimized, no dates)
 * This is used for efficient semver resolution without fetching dates
 */
async function getAllItemNamesFromRepo(
  config: RepoConfig,
  itemType: 'tags' | 'release'
): Promise<string[]> {
  // Releases are not supported for local repositories
  if (itemType === 'release' && config.type === 'local') {
    throw new Error('Releases are not supported for local repositories');
  }

  if (config.type === 'local') {
    if (!config.path) {
      throw new Error('Local repository path is required');
    }
    if (itemType === 'release') {
      throw new Error('Releases are not supported for local repositories');
    }
    return getLocalTags(config.path);
  }

  if (config.type === 'remote') {
    if (!config.platform || !config.owner || !config.repo) {
      throw new Error('Remote repository configuration is incomplete');
    }

    if (itemType === 'release') {
      // Route to release name listing functions
      switch (config.platform) {
        case Platform.GITHUB:
          return await getGithubReleaseNames(config.owner, config.repo, config.token, config.ignoreCertErrors);
        case Platform.GITEA:
          if (!config.baseUrl) {
            throw new Error('Gitea base URL is required');
          }
          return await getGiteaReleaseNames(
            config.owner,
            config.repo,
            config.baseUrl,
            config.token,
            config.ignoreCertErrors
          );
        case Platform.BITBUCKET:
          return await getBitbucketReleaseNames(config.owner, config.repo, config.token, config.ignoreCertErrors);
        default:
          throw new Error(`Unsupported platform: ${config.platform}`);
      }
    } else {
      // For GitHub tags, use the optimized function that doesn't fetch dates
      if (config.platform === Platform.GITHUB) {
        return await getGithubTagNames(config.owner, config.repo, config.token, config.ignoreCertErrors);
      }

      // For other platforms, we need to fetch tags with dates (they're efficient anyway)
      // but we'll extract just the names
      const tags = await getAllItemsFromRepo(config, 'tags');
      return tags.map((tag) => tag.name);
    }
  }

  throw new Error('Invalid repository configuration');
}

/**
 * Filter tags with fallback pattern support
 * Tries each pattern in order until one matches tags
 * 
 * @param tagNames - Array of tag names to filter
 * @param patterns - Array of format patterns to try in order
 * @param context - Context string for logging (e.g., "GitHub optimized path")
 * @returns Array of tag names that match the first successful pattern
 * @throws Error if no patterns match any tags
 */
async function filterTagsWithFallback(
  tagNames: string[],
  patterns: string[],
  context: string
): Promise<string[]> {
  const attemptedPatterns: string[] = [];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const filtered = filterTagsByFormat(tagNames, pattern);
    
    core.info(
      `Format filtering (${context}): Pattern "${pattern}" matches ${filtered.length} of ${tagNames.length} tags`
    );

    if (filtered.length > 0) {
      if (i > 0) {
        core.info(
          `Using fallback pattern "${pattern}" (pattern ${i + 1} of ${patterns.length}) - previous patterns matched no tags`
        );
      }
      return filtered;
    }

    attemptedPatterns.push(pattern);
    if (i < patterns.length - 1) {
      core.info(`Pattern "${pattern}" matched no tags, trying next pattern...`);
    }
  }

  // All patterns exhausted, none matched
  const patternsList = attemptedPatterns.map((p) => `"${p}"`).join(', ');
  throw new Error(
    `No tags found matching any format pattern: [${patternsList}]. Tried ${attemptedPatterns.length} pattern(s) in fallback order.`
  );
}

/**
 * Resolve "latest" item name (tag or release)
 * Strategy: Try semver first (using fast name-only fetch for GitHub), then fallback to date
 * If tagFormat is provided, filter items by format before sorting
 * If tagFormat is an array, try each pattern in order as fallbacks
 */
export async function resolveLatestTag(
  config: RepoConfig,
  tagFormat?: string | string[],
  itemType: 'tags' | 'release' = 'tags'
): Promise<string> {
  const itemLabel = itemType === 'release' ? 'release' : 'tag';
  core.info(`Resolving latest ${itemLabel}...`);

  // Normalize tagFormat to array for consistent handling
  const formatPatterns: string[] | undefined = Array.isArray(tagFormat)
    ? tagFormat
    : tagFormat
    ? [tagFormat]
    : undefined;

  // If tagFormat is provided, log it
  if (formatPatterns) {
    if (formatPatterns.length === 1) {
      core.info(`Filtering tags by format: ${formatPatterns[0]}`);
    } else {
      core.info(`Filtering tags by format patterns (fallback order): ${formatPatterns.join(', ')}`);
    }
  }

  // Optimization: For GitHub, first try to get just item names (fast, no dates)
  // and check if we can resolve using semver without fetching dates
  if (config.type === 'remote' && config.platform === Platform.GITHUB && itemType === 'tags') {
    try {
      const itemNames = await getAllItemNamesFromRepo(config, itemType);

      if (itemNames.length === 0) {
        throw new Error(`No ${itemLabel}s found in repository`);
      }

      // Apply format filtering if provided (with fallback support)
      let filteredItemNames = itemNames;
      if (formatPatterns) {
        filteredItemNames = await filterTagsWithFallback(itemNames, formatPatterns, 'GitHub optimized path');
      }

      // Filter semver items from the (potentially format-filtered) items
      const semverItems = filteredItemNames.filter((itemName) => isSemver(itemName));

      if (semverItems.length > 0) {
        core.info(`Found ${semverItems.length} semver ${itemLabel}s, using semver comparison (optimized: no date fetching needed)`);
        // Sort by semver (highest first)
        const sorted = sortTagsBySemver(semverItems);
        const latest = sorted[0];
        core.info(`Latest semver ${itemLabel}: ${latest}`);
        return latest;
      }

      // If no semver items, fall through to date-based sorting below
      core.info(`No semver ${itemLabel}s found, falling back to date-based sorting`);
    } catch (error) {
      // If optimized path fails, fall through to full item fetch
      if (error instanceof Error && error.message.includes('No tags found matching format pattern')) {
        // Re-throw format matching errors (after all fallbacks exhausted)
        throw error;
      }
      core.warning(`Optimized ${itemLabel} name fetch failed, using full ${itemLabel} fetch: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  // For non-GitHub platforms, releases, or if semver failed, get items with dates
  const allItems = await getAllItemsFromRepo(config, itemType);

  if (allItems.length === 0) {
    throw new Error(`No ${itemLabel}s found in repository`);
  }

  // Apply format filtering if provided (with fallback support)
  let filteredItems = allItems;
  if (formatPatterns) {
    const allItemNames = allItems.map((item) => item.name);
    const filteredItemNames = await filterTagsWithFallback(allItemNames, formatPatterns, `full ${itemLabel} fetch path`);
    
    // Filter items to only those matching the format
    filteredItems = allItems.filter((item) => filteredItemNames.includes(item.name));
  }

  // Filter semver items (in case we didn't check earlier)
  const semverItems = filteredItems.filter((item) => isSemver(item.name));

  if (semverItems.length > 0) {
    core.info(`Found ${semverItems.length} semver ${itemLabel}s, using semver comparison`);
    // Sort by semver (highest first)
    const sorted = sortTagsBySemver(semverItems.map((t) => t.name));
    const latest = sorted[0];
    core.info(`Latest semver ${itemLabel}: ${latest}`);
    return latest;
  }

  // Fallback to date-based sorting
  core.info(`No semver ${itemLabel}s found, falling back to date-based sorting`);
  const itemsWithDates = filteredItems.filter((item) => item.date);

  if (itemsWithDates.length > 0) {
    // Sort by date (most recent first)
    const sorted = itemsWithDates.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order
    });
    const latest = sorted[0].name;
    core.info(`Latest ${itemLabel} by date: ${latest}`);
    return latest;
  }

  // If no dates available, return the last item alphabetically (fallback)
  core.warning('No date information available, using alphabetical order');
  const sorted = filteredItems.map((t) => t.name).sort();
  return sorted[sorted.length - 1];
}

