import {
  parseSemver,
  isSemver,
  compareSemver,
  sortTagsBySemver,
} from '../semver';

describe('semver', () => {
  describe('parseSemver', () => {
    it('should parse standard semver tags', () => {
      expect(parseSemver('1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
      expect(parseSemver('v1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
      expect(parseSemver('V10.20.30')).toEqual({
        major: 10,
        minor: 20,
        patch: 30,
      });
    });

    it('should parse semver with prerelease', () => {
      expect(parseSemver('1.2.3-alpha')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
      });
      expect(parseSemver('v1.2.3-beta.1')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.1',
      });
    });

    it('should parse semver with build metadata', () => {
      expect(parseSemver('1.2.3+build.1')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        build: 'build.1',
      });
      expect(parseSemver('v1.2.3-alpha+build.1')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
        build: 'build.1',
      });
    });

    it('should return null for invalid semver', () => {
      expect(parseSemver('not-a-version')).toBeNull();
      expect(parseSemver('1.2')).toBeNull();
      expect(parseSemver('1')).toBeNull();
      expect(parseSemver('v1')).toBeNull();
      expect(parseSemver('latest')).toBeNull();
    });

    it('should parse namespaced tags carrying a name prefix', () => {
      // n8n tags every release as `n8n@X.Y.Z`; treating these as non-semver is
      // what sent callers down the date-ordered fallback.
      expect(parseSemver('n8n@2.39.9')).toEqual({
        major: 2,
        minor: 39,
        patch: 9,
      });
      expect(parseSemver('pkg/1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseSemver('release-1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
      expect(parseSemver('rel_1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseSemver('@scope/pkg@1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
      expect(parseSemver('n8n@v2.39.9')).toEqual({
        major: 2,
        minor: 39,
        patch: 9,
      });
    });

    it('should not mistake a prerelease suffix for a name prefix', () => {
      // '1.2.3-alpha' must parse as 1.2.3-alpha, never as the version 'alpha'.
      expect(parseSemver('1.2.3-alpha')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha',
      });
      // With a prefix as well, the tail alone ('beta.1') is not a version, so
      // parsing must fall back to the earlier separator.
      expect(parseSemver('release-2.0.0-beta.1')).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
      });
      expect(parseSemver('n8n@2.40.4-rc.1+build.7')).toEqual({
        major: 2,
        minor: 40,
        patch: 4,
        prerelease: 'rc.1',
        build: 'build.7',
      });
    });

    it('should still reject moving and non-version tags', () => {
      // These are exactly the tags n8n publishes alongside its versioned ones;
      // if any of them parsed, `latest` could resolve to a moving target.
      expect(parseSemver('stable')).toBeNull();
      expect(parseSemver('beta')).toBeNull();
      expect(parseSemver('nightly')).toBeNull();
      expect(parseSemver('2026-09-21')).toBeNull();
      expect(parseSemver('edge-e9613ab3-ls213')).toBeNull();
      expect(parseSemver('n8n@2.39')).toBeNull();
      expect(parseSemver('-1.2.3')).toBeNull();
    });
  });

  describe('isSemver', () => {
    it('should return true for valid semver', () => {
      expect(isSemver('1.2.3')).toBe(true);
      expect(isSemver('v1.2.3')).toBe(true);
      expect(isSemver('1.2.3-alpha')).toBe(true);
    });

    it('should return false for invalid semver', () => {
      expect(isSemver('not-a-version')).toBe(false);
      expect(isSemver('1.2')).toBe(false);
      expect(isSemver('latest')).toBe(false);
    });
  });

  describe('compareSemver', () => {
    it('should compare major versions', () => {
      expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
      expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
    });

    it('should compare minor versions', () => {
      expect(compareSemver('1.1.0', '1.2.0')).toBe(-1);
      expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
    });

    it('should compare patch versions', () => {
      expect(compareSemver('1.2.1', '1.2.2')).toBe(-1);
      expect(compareSemver('1.2.2', '1.2.1')).toBe(1);
    });

    it('should return 0 for equal versions', () => {
      expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
      expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
    });

    it('should handle prerelease versions', () => {
      expect(compareSemver('1.2.3-alpha', '1.2.3')).toBe(-1);
      expect(compareSemver('1.2.3', '1.2.3-alpha')).toBe(1);
      expect(compareSemver('1.2.3-alpha', '1.2.3-beta')).toBe(-1); // Lexicographic: alpha < beta
      expect(compareSemver('1.2.3-beta', '1.2.3-alpha')).toBe(1);
    });

    it('should return 0 for non-semver tags', () => {
      expect(compareSemver('not-a-version', 'also-not')).toBe(0);
    });
  });

  describe('sortTagsBySemver', () => {
    it('should sort tags by semver (highest first)', () => {
      const tags = ['1.0.0', '2.0.0', '1.5.0', '1.2.3'];
      const sorted = sortTagsBySemver(tags);
      expect(sorted).toEqual(['2.0.0', '1.5.0', '1.2.3', '1.0.0']);
    });

    it('should handle v-prefixed tags', () => {
      const tags = ['v1.0.0', 'v2.0.0', 'v1.5.0'];
      const sorted = sortTagsBySemver(tags);
      expect(sorted).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0']);
    });

    it('should order namespaced tags by version across release lines', () => {
      // The real regression: n8n maintains a 1.123.x LTS line alongside 2.x.
      // Ordering these by date picks whichever published last; only version
      // ordering reliably yields the highest.
      const tags = ['n8n@1.123.81', 'n8n@2.39.7', 'n8n@2.39.9', 'n8n@2.9.4'];
      expect(sortTagsBySemver(tags)).toEqual([
        'n8n@2.39.9',
        'n8n@2.39.7',
        'n8n@2.9.4',
        'n8n@1.123.81',
      ]);
    });

    it('should handle mixed v-prefixed and non-prefixed tags', () => {
      const tags = ['1.0.0', 'v2.0.0', 'v1.5.0'];
      const sorted = sortTagsBySemver(tags);
      expect(sorted).toEqual(['v2.0.0', 'v1.5.0', '1.0.0']);
    });

    it('should sort all tags (non-semver tags compare as equal)', () => {
      // Test with only semver tags to verify sorting works
      const semverTags = ['1.0.0', '2.0.0', '1.5.0'];
      const sortedSemver = sortTagsBySemver(semverTags);
      expect(sortedSemver).toEqual(['2.0.0', '1.5.0', '1.0.0']);

      // Test with mixed tags - non-semver tags maintain relative order
      const mixedTags = ['1.0.0', 'not-semver', '2.0.0', 'also-not'];
      const sorted = sortTagsBySemver(mixedTags);
      // All tags should be present
      expect(sorted).toContain('2.0.0');
      expect(sorted).toContain('1.0.0');
      expect(sorted).toContain('not-semver');
      expect(sorted).toContain('also-not');
      // Note: Due to stable sort and non-semver tags comparing as equal,
      // the exact order may vary, but semver tags should be relatively sorted
    });
  });
});

