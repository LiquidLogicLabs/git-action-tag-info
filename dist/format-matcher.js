"use strict";
/**
 * Format matching utilities for tag filtering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSimplePattern = isSimplePattern;
exports.isWildcardPattern = isWildcardPattern;
exports.convertSimplePatternToRegex = convertSimplePatternToRegex;
exports.convertWildcardPatternToRegex = convertWildcardPatternToRegex;
exports.isRegexPattern = isRegexPattern;
exports.matchTagFormat = matchTagFormat;
exports.filterTagsByFormat = filterTagsByFormat;
/**
 * Check if a format string is a simple pattern (e.g., "X.X" or "X.X.X")
 * Simple patterns use X as a placeholder for numbers
 */
function isSimplePattern(format) {
    // Simple patterns contain only X, dots, and optional v prefix
    // Examples: "X.X", "X.X.X", "vX.X.X"
    const simplePatternRegex = /^v?X(\.X)+$/i;
    return simplePatternRegex.test(format);
}
/**
 * Check if a format string is a wildcard pattern (e.g., "*", "*.*", "*.*.*")
 * Wildcard patterns use * as a placeholder for any characters
 */
function isWildcardPattern(format) {
    // Wildcard patterns contain * and dots
    // Examples: "*", "*.*", "*.*.*", "v*.*.*"
    const wildcardPatternRegex = /^v?\*(\.\*)*$/i;
    return wildcardPatternRegex.test(format);
}
/**
 * Convert a simple pattern to a regex
 * "X.X" → /^\d+\.\d+$/
 * "X.X.X" → /^\d+\.\d+\.\d+$/
 * "vX.X.X" → /^v\d+\.\d+\.\d+$/
 */
function convertSimplePatternToRegex(format) {
    // Replace X with \d+ (one or more digits)
    // Escape dots to match literal dots
    let regexPattern = format.replace(/X/gi, '\\d+');
    // Add anchors for full match
    regexPattern = `^${regexPattern}$`;
    return new RegExp(regexPattern);
}
/**
 * Convert a wildcard pattern to a regex
 * "*" → /^[^.]*$/
 * "*.*" → /^[^.]*\.[^.]*$/
 * "*.*.*" → /^[^.]*\.[^.]*\.[^.]*$/
 * "v*.*.*" → /^v[^.]*\.[^.]*\.[^.]*$/
 */
function convertWildcardPatternToRegex(format) {
    // Replace * with [^.]* (any characters except dots)
    // This matches a single segment (non-dot characters)
    // Escape dots to match literal dots (important: . in regex matches any char!)
    let regexPattern = format.replace(/\*/g, '[^.]*').replace(/\./g, '\\.');
    // Add anchors for full match
    regexPattern = `^${regexPattern}$`;
    return new RegExp(regexPattern);
}
/**
 * Check if a format string looks like a regex pattern
 * Regex patterns typically start with ^ or contain regex special characters
 * Note: * is not treated as regex special char here since it's used for wildcard patterns
 */
function isRegexPattern(format) {
    // If it starts with ^ or /, treat as regex
    if (format.startsWith('^') || format.startsWith('/')) {
        return true;
    }
    // Check for regex special characters (excluding * which is used for wildcards)
    // Only treat as regex if it contains other special characters
    const regexSpecialChars = /[()[\]{}+?|\\]/;
    return regexSpecialChars.test(format);
}
/**
 * Extract prefix from tag name (before first non-numeric/non-dot character)
 * Used for prefix matching with numeric patterns (X.X)
 * Examples:
 *   "3.23-bae0df8a-ls3" → "3.23"
 *   "v1.2.3-alpha" → "v1.2.3"
 *   "2.5" → "2.5"
 */
function extractNumericPrefix(tagName) {
    // Match from start: optional 'v', then digits and dots
    const prefixMatch = tagName.match(/^(v?\d+(?:\.\d+)*)/);
    return prefixMatch ? prefixMatch[1] : '';
}
/**
 * Extract prefix from tag name (before first non-alphanumeric/non-dot character)
 * Used for prefix matching with wildcard patterns (*.*)
 * Examples:
 *   "3.23-bae0df8a-ls3" → "3.23"
 *   "abc.def-123" → "abc.def"
 *   "v1.2.3-alpha" → "v1.2.3"
 *   "edge-e9613ab3-ls213" → "" (no dots, so no prefix to extract)
 */
function extractWildcardPrefix(tagName) {
    // Match from start: optional 'v', then alphanumeric characters and dots
    // Must contain at least one dot to be a valid prefix for *.* patterns
    const prefixMatch = tagName.match(/^(v?[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)/);
    return prefixMatch ? prefixMatch[1] : '';
}
/**
 * Match a tag name against a format pattern
 * Supports both full match and prefix match
 *
 * @param tagName - The tag name to match
 * @param format - The format pattern (simple like "X.X" or regex)
 * @returns true if tag matches the format
 */
function matchTagFormat(tagName, format) {
    if (!format || !tagName) {
        return false;
    }
    let regex;
    let isWildcard = false;
    // Determine if it's a simple pattern, wildcard pattern, or regex
    if (isSimplePattern(format)) {
        regex = convertSimplePatternToRegex(format);
    }
    else if (isWildcardPattern(format)) {
        regex = convertWildcardPatternToRegex(format);
        isWildcard = true;
    }
    else if (isRegexPattern(format)) {
        // Handle regex patterns
        // Remove leading/trailing slashes if present (e.g., "/pattern/" → "pattern")
        let regexStr = format.replace(/^\/|\/$/g, '');
        // If it doesn't start with ^, add it for full match
        if (!regexStr.startsWith('^')) {
            regexStr = `^${regexStr}`;
        }
        // If it doesn't end with $, add it for full match
        if (!regexStr.endsWith('$')) {
            regexStr = `${regexStr}$`;
        }
        try {
            regex = new RegExp(regexStr);
        }
        catch {
            // Invalid regex, return false
            return false;
        }
    }
    else {
        // Treat as literal string (exact match)
        return tagName === format;
    }
    // For wildcard patterns, try prefix match first (more reliable for tags with suffixes)
    // For other patterns, try full match first
    if (isWildcard) {
        // Try prefix match first for wildcard patterns
        const prefix = extractWildcardPrefix(tagName);
        if (prefix && regex.test(prefix)) {
            return true;
        }
        // If prefix match fails, try full match
        if (regex.test(tagName)) {
            return true;
        }
    }
    else {
        // Try full match first for non-wildcard patterns
        if (regex.test(tagName)) {
            return true;
        }
        // If full match fails, try prefix match
        const prefix = extractNumericPrefix(tagName);
        if (prefix && regex.test(prefix)) {
            return true;
        }
    }
    return false;
}
/**
 * Filter tags by format pattern
 *
 * @param tagNames - Array of tag names to filter
 * @param format - The format pattern to match against
 * @returns Array of tag names that match the format
 */
function filterTagsByFormat(tagNames, format) {
    if (!format) {
        return tagNames;
    }
    return tagNames.filter((tagName) => matchTagFormat(tagName, format));
}
//# sourceMappingURL=format-matcher.js.map