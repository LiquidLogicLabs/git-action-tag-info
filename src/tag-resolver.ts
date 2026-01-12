import * as core from '@actions/core';
import { PlatformAPI, Platform } from './types';
import { isSemver, sortTagsBySemver } from './semver';
import { filterTagsByFormat } from './format-matcher';

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
 * Strategy: Try semver first (using fast name-only fetch when available), then fallback to date
 * If tagFormat is provided, filter items by format before sorting
 * If tagFormat is an array, try each pattern in order as fallbacks
 */
export async function resolveLatestTag(
  platformAPI: PlatformAPI,
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

  // Optimization: For tags, first try to get just item names (fast, no dates)
  // and check if we can resolve using semver without fetching dates
  if (itemType === 'tags') {
    try {
      const itemNames = await platformAPI.getAllTagNames();

      if (itemNames.length === 0) {
        throw new Error(`No ${itemLabel}s found in repository`);
      }

      // Apply format filtering if provided (with fallback support)
      let filteredItemNames = itemNames;
      if (formatPatterns) {
        filteredItemNames = await filterTagsWithFallback(itemNames, formatPatterns, 'optimized path');
      }

      // Filter semver items from the (potentially format-filtered) items
      const semverItems = filteredItemNames.filter((itemName: string) => isSemver(itemName));

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

  // For releases or if semver failed, get items with dates
  const allItems = itemType === 'tags'
    ? await platformAPI.getAllTags()
    : await platformAPI.getAllReleases();

  if (allItems.length === 0) {
    throw new Error(`No ${itemLabel}s found in repository`);
  }

  // Apply format filtering if provided (with fallback support)
  let filteredItems = allItems;
  if (formatPatterns) {
    const allItemNames = allItems.map((item: { name: string; date: string }) => item.name);
    const filteredItemNames = await filterTagsWithFallback(allItemNames, formatPatterns, `full ${itemLabel} fetch path`);
    
    // Filter items to only those matching the format
    filteredItems = allItems.filter((item: { name: string; date: string }) => filteredItemNames.includes(item.name));
  }

  // Filter semver items (in case we didn't check earlier)
  const semverItems = filteredItems.filter((item: { name: string; date: string }) => isSemver(item.name));

  if (semverItems.length > 0) {
    core.info(`Found ${semverItems.length} semver ${itemLabel}s, using semver comparison`);
    // Sort by semver (highest first)
    const sorted = sortTagsBySemver(semverItems.map((t: { name: string; date: string }) => t.name));
    const latest = sorted[0];
    core.info(`Latest semver ${itemLabel}: ${latest}`);
    return latest;
  }

  // Fallback to date-based sorting
  core.info(`No semver ${itemLabel}s found, falling back to date-based sorting`);
  const itemsWithDates = filteredItems.filter((item: { name: string; date: string }) => item.date);

  if (itemsWithDates.length > 0) {
    // Sort by date (most recent first)
    const sorted = itemsWithDates.sort((a: { name: string; date: string }, b: { name: string; date: string }) => {
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
  const sorted = filteredItems.map((t: { name: string; date: string }) => t.name).sort();
  return sorted[sorted.length - 1];
}

