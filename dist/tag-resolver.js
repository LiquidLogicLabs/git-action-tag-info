"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLatestTag = resolveLatestTag;
const core = __importStar(require("@actions/core"));
const types_1 = require("./types");
const git_client_1 = require("./git-client");
const github_client_1 = require("./github-client");
const gitea_client_1 = require("./gitea-client");
const bitbucket_client_1 = require("./bitbucket-client");
const semver_1 = require("./semver");
const format_matcher_1 = require("./format-matcher");
/**
 * Get all tags from repository based on configuration
 */
async function getAllTagsFromRepo(config) {
    if (config.type === 'local') {
        if (!config.path) {
            throw new Error('Local repository path is required');
        }
        const tags = (0, git_client_1.getAllTags)(config.path);
        // For local tags, we don't have dates easily available, so return empty dates
        return tags.map((name) => ({ name, date: '' }));
    }
    if (config.type === 'remote') {
        if (!config.platform || !config.owner || !config.repo) {
            throw new Error('Remote repository configuration is incomplete');
        }
        switch (config.platform) {
            case types_1.Platform.GITHUB:
                return await (0, github_client_1.getAllTags)(config.owner, config.repo, config.token, config.ignoreCertErrors);
            case types_1.Platform.GITEA:
                if (!config.baseUrl) {
                    throw new Error('Gitea base URL is required');
                }
                return await (0, gitea_client_1.getAllTags)(config.owner, config.repo, config.baseUrl, config.token, config.ignoreCertErrors);
            case types_1.Platform.BITBUCKET:
                return await (0, bitbucket_client_1.getAllTags)(config.owner, config.repo, config.token, config.ignoreCertErrors);
            default:
                throw new Error(`Unsupported platform: ${config.platform}`);
        }
    }
    throw new Error('Invalid repository configuration');
}
/**
 * Get all tag names from repository (optimized, no dates)
 * This is used for efficient semver resolution without fetching dates
 */
async function getAllTagNamesFromRepo(config) {
    if (config.type === 'local') {
        if (!config.path) {
            throw new Error('Local repository path is required');
        }
        return (0, git_client_1.getAllTags)(config.path);
    }
    if (config.type === 'remote') {
        if (!config.platform || !config.owner || !config.repo) {
            throw new Error('Remote repository configuration is incomplete');
        }
        // For GitHub, use the optimized function that doesn't fetch dates
        if (config.platform === types_1.Platform.GITHUB) {
            return await (0, github_client_1.getAllTagNames)(config.owner, config.repo, config.token, config.ignoreCertErrors);
        }
        // For other platforms, we need to fetch tags with dates (they're efficient anyway)
        // but we'll extract just the names
        const tags = await getAllTagsFromRepo(config);
        return tags.map((tag) => tag.name);
    }
    throw new Error('Invalid repository configuration');
}
/**
 * Resolve "latest" tag name
 * Strategy: Try semver first (using fast name-only fetch for GitHub), then fallback to date
 * If tagFormat is provided, filter tags by format before sorting
 */
async function resolveLatestTag(config, tagFormat) {
    core.info('Resolving latest tag...');
    // If tagFormat is provided, log it
    if (tagFormat) {
        core.info(`Filtering tags by format: ${tagFormat}`);
    }
    // Optimization: For GitHub, first try to get just tag names (fast, no dates)
    // and check if we can resolve using semver without fetching dates
    if (config.type === 'remote' && config.platform === types_1.Platform.GITHUB) {
        try {
            const tagNames = await getAllTagNamesFromRepo(config);
            if (tagNames.length === 0) {
                throw new Error('No tags found in repository');
            }
            // Apply format filtering if provided
            let filteredTagNames = tagNames;
            if (tagFormat) {
                filteredTagNames = (0, format_matcher_1.filterTagsByFormat)(tagNames, tagFormat);
                core.info(`Format filtering: ${filteredTagNames.length} of ${tagNames.length} tags match format "${tagFormat}"`);
                if (filteredTagNames.length === 0) {
                    throw new Error(`No tags found matching format pattern "${tagFormat}"`);
                }
            }
            // Filter semver tags from the (potentially format-filtered) tags
            const semverTags = filteredTagNames.filter((tagName) => (0, semver_1.isSemver)(tagName));
            if (semverTags.length > 0) {
                core.info(`Found ${semverTags.length} semver tags, using semver comparison (optimized: no date fetching needed)`);
                // Sort by semver (highest first)
                const sorted = (0, semver_1.sortTagsBySemver)(semverTags);
                const latest = sorted[0];
                core.info(`Latest semver tag: ${latest}`);
                return latest;
            }
            // If no semver tags, fall through to date-based sorting below
            core.info('No semver tags found, falling back to date-based sorting');
        }
        catch (error) {
            // If optimized path fails, fall through to full tag fetch
            if (error instanceof Error && error.message.includes('No tags found matching format')) {
                // Re-throw format matching errors
                throw error;
            }
            core.warning(`Optimized tag name fetch failed, using full tag fetch: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
    // For non-GitHub platforms or if semver failed, get tags with dates
    const allTags = await getAllTagsFromRepo(config);
    if (allTags.length === 0) {
        throw new Error('No tags found in repository');
    }
    // Apply format filtering if provided
    let filteredTags = allTags;
    if (tagFormat) {
        const filteredTagNames = (0, format_matcher_1.filterTagsByFormat)(allTags.map((tag) => tag.name), tagFormat);
        core.info(`Format filtering: ${filteredTagNames.length} of ${allTags.length} tags match format "${tagFormat}"`);
        if (filteredTagNames.length === 0) {
            throw new Error(`No tags found matching format pattern "${tagFormat}"`);
        }
        // Filter tags to only those matching the format
        filteredTags = allTags.filter((tag) => filteredTagNames.includes(tag.name));
    }
    // Filter semver tags (in case we didn't check earlier)
    const semverTags = filteredTags.filter((tag) => (0, semver_1.isSemver)(tag.name));
    if (semverTags.length > 0) {
        core.info(`Found ${semverTags.length} semver tags, using semver comparison`);
        // Sort by semver (highest first)
        const sorted = (0, semver_1.sortTagsBySemver)(semverTags.map((t) => t.name));
        const latest = sorted[0];
        core.info(`Latest semver tag: ${latest}`);
        return latest;
    }
    // Fallback to date-based sorting
    core.info('No semver tags found, falling back to date-based sorting');
    const tagsWithDates = filteredTags.filter((tag) => tag.date);
    if (tagsWithDates.length > 0) {
        // Sort by date (most recent first)
        const sorted = tagsWithDates.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; // Descending order
        });
        const latest = sorted[0].name;
        core.info(`Latest tag by date: ${latest}`);
        return latest;
    }
    // If no dates available, return the last tag alphabetically (fallback)
    core.warning('No date information available, using alphabetical order');
    const sorted = filteredTags.map((t) => t.name).sort();
    return sorted[sorted.length - 1];
}
//# sourceMappingURL=tag-resolver.js.map