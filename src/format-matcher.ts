/**
 * Format matching utilities for tag filtering
 */

/**
 * Check if a format string is a simple pattern (e.g., "X.X" or "X.X.X")
 * Simple patterns use X as a placeholder for numbers
 */
export function isSimplePattern(format: string): boolean {
  // Simple patterns contain only X, dots, and optional v prefix
  // Examples: "X.X", "X.X.X", "vX.X.X"
  const simplePatternRegex = /^v?X(\.X)+$/i;
  return simplePatternRegex.test(format);
}

/**
 * Convert a simple pattern to a regex
 * "X.X" → /^\d+\.\d+$/
 * "X.X.X" → /^\d+\.\d+\.\d+$/
 * "vX.X.X" → /^v\d+\.\d+\.\d+$/
 */
export function convertSimplePatternToRegex(format: string): RegExp {
  // Replace X with \d+ (one or more digits)
  // Escape dots to match literal dots
  let regexPattern = format.replace(/X/gi, '\\d+');
  
  // Add anchors for full match
  regexPattern = `^${regexPattern}$`;
  
  return new RegExp(regexPattern);
}

/**
 * Check if a format string looks like a regex pattern
 * Regex patterns typically start with ^ or contain regex special characters
 */
export function isRegexPattern(format: string): boolean {
  // If it starts with ^ or contains regex special characters, treat as regex
  if (format.startsWith('^') || format.startsWith('/')) {
    return true;
  }
  
  // Check for regex special characters that wouldn't appear in simple patterns
  const regexSpecialChars = /[()[\]{}*+?|\\]/;
  return regexSpecialChars.test(format);
}

/**
 * Extract prefix from tag name (before first non-numeric/non-dot character)
 * Used for prefix matching
 * Examples:
 *   "3.23-bae0df8a-ls3" → "3.23"
 *   "v1.2.3-alpha" → "v1.2.3"
 *   "2.5" → "2.5"
 */
function extractPrefix(tagName: string): string {
  // Match from start: optional 'v', then digits and dots
  const prefixMatch = tagName.match(/^(v?\d+(?:\.\d+)*)/);
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
export function matchTagFormat(tagName: string, format: string): boolean {
  if (!format || !tagName) {
    return false;
  }

  let regex: RegExp;

  // Determine if it's a simple pattern or regex
  if (isSimplePattern(format)) {
    regex = convertSimplePatternToRegex(format);
  } else if (isRegexPattern(format)) {
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
    } catch (error) {
      // Invalid regex, return false
      return false;
    }
  } else {
    // Treat as literal string (exact match)
    return tagName === format;
  }

  // Try full match first
  if (regex.test(tagName)) {
    return true;
  }

  // If full match fails, try prefix match
  const prefix = extractPrefix(tagName);
  if (prefix && regex.test(prefix)) {
    return true;
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
export function filterTagsByFormat(tagNames: string[], format: string): string[] {
  if (!format) {
    return tagNames;
  }

  return tagNames.filter((tagName) => matchTagFormat(tagName, format));
}

