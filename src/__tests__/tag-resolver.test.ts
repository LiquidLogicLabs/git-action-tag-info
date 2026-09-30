import { resolveLatestTag, filterPublishedReleases } from '../tag-resolver';
import { PlatformAPI, ReleaseSummary } from '../types';

// Create mock PlatformAPI
function createMockPlatformAPI(mocks: {
  getAllTagNames?: () => Promise<string[]>;
  getAllTags?: () => Promise<Array<{ name: string; date: string }>>;
  getAllReleaseNames?: () => Promise<string[]>;
  getAllReleases?: () => Promise<ReleaseSummary[]>;
}): PlatformAPI {
  return {
    getTagInfo: jest.fn(),
    getReleaseInfo: jest.fn(),
    getAllTagNames: mocks.getAllTagNames || jest.fn().mockResolvedValue([]),
    getAllTags: mocks.getAllTags || jest.fn().mockResolvedValue([]),
    getAllReleaseNames: mocks.getAllReleaseNames || jest.fn().mockResolvedValue([]),
    getAllReleases: mocks.getAllReleases || jest.fn().mockResolvedValue([]),
  };
}

describe('tag-resolver', () => {
  describe('resolveLatestTag', () => {
    it('should return highest semver tag when semver tags exist', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllTags: jest.fn().mockResolvedValue([
          { name: '1.0.0', date: '2024-01-01' },
          { name: '2.0.0', date: '2024-01-02' },
          { name: '1.5.0', date: '2024-01-03' },
        ]),
      });

      const latest = await resolveLatestTag(mockAPI);
      expect(latest).toBe('2.0.0');
    });

    it('should fallback to date when no semver tags exist', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllTags: jest.fn().mockResolvedValue([
          { name: 'release-1', date: '2024-01-01T00:00:00Z' },
          { name: 'release-2', date: '2024-01-03T00:00:00Z' },
          { name: 'release-3', date: '2024-01-02T00:00:00Z' },
        ]),
      });

      const latest = await resolveLatestTag(mockAPI);
      expect(latest).toBe('release-2'); // Most recent by date
    });

    it('should work with local repositories', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllTagNames: jest.fn().mockResolvedValue([
          'v2.0.0',
          'v1.5.0',
          'v1.0.0',
        ]),
        getAllTags: jest.fn().mockResolvedValue([
          { name: 'v2.0.0', date: '' },
          { name: 'v1.5.0', date: '' },
          { name: 'v1.0.0', date: '' },
        ]),
      });

      const latest = await resolveLatestTag(mockAPI);
      expect(latest).toBe('v2.0.0');
    });

    it('should throw error when no tags found', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllTags: jest.fn().mockResolvedValue([]),
      });

      await expect(resolveLatestTag(mockAPI)).rejects.toThrow('No tags found');
    });

    it('should use alphabetical fallback when no dates available', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllTagNames: jest.fn().mockResolvedValue([
          'tag-a',
          'tag-z',
          'tag-m',
        ]),
        getAllTags: jest.fn().mockResolvedValue([
          { name: 'tag-a', date: '' },
          { name: 'tag-z', date: '' },
          { name: 'tag-m', date: '' },
        ]),
      });

      const latest = await resolveLatestTag(mockAPI);
      expect(latest).toBe('tag-z'); // Last alphabetically
    });

    describe('format filtering', () => {
      it('should filter tags by X.X format before semver sorting', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            '3.23-bae0df8a-ls3',
            '3.22-c210e9fe-ls18',
            'edge-e9613ab3-ls213',
            '3.21-633fbea2-ls27',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: '3.23-bae0df8a-ls3', date: '2024-01-03' },
            { name: '3.22-c210e9fe-ls18', date: '2024-01-02' },
            { name: 'edge-e9613ab3-ls213', date: '2024-01-04' },
            { name: '3.21-633fbea2-ls27', date: '2024-01-01' },
          ]),
        });

        const latest = await resolveLatestTag(mockAPI, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3'); // Highest semver among filtered tags
      });

      it('should filter tags by X.X format and use date sorting when no semver', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            'edge-e9613ab3-ls213',
            '3.23-bae0df8a-ls3',
            '3.22-c210e9fe-ls18',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: 'edge-e9613ab3-ls213', date: '2024-01-03T00:00:00Z' },
            { name: '3.23-bae0df8a-ls3', date: '2024-01-02T00:00:00Z' },
            { name: '3.22-c210e9fe-ls18', date: '2024-01-01T00:00:00Z' },
          ]),
        });

        const latest = await resolveLatestTag(mockAPI, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3'); // Most recent by date among filtered tags
      });

      it('should filter tags by X.X.X format', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            '1.2.3',
            '1.2.3-alpha',
            '2.0.0',
            'edge-e9613ab3-ls213',
            '3.23-bae0df8a-ls3',
          ]),
        });

        const latest = await resolveLatestTag(mockAPI, 'X.X.X');
        expect(latest).toBe('2.0.0'); // Highest semver among X.X.X tags
      });

      it('should throw error when no tags match format', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            'edge-e9613ab3-ls213',
            'latest',
            'dev',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: 'edge-e9613ab3-ls213', date: '2024-01-03' },
            { name: 'latest', date: '2024-01-02' },
            { name: 'dev', date: '2024-01-01' },
          ]),
        });

        // X.X requires a dot, these tags have no dots, so should fail
        await expect(resolveLatestTag(mockAPI, 'X.X')).rejects.toThrow(
          'No tags found matching any format pattern'
        );
      });

      it('should preserve backward compatibility when format is not provided', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTags: jest.fn().mockResolvedValue([
            { name: '1.0.0', date: '2024-01-01' },
            { name: '2.0.0', date: '2024-01-02' },
            { name: '1.5.0', date: '2024-01-03' },
          ]),
        });

        // Without format - should behave as before
        const latest = await resolveLatestTag(mockAPI);
        expect(latest).toBe('2.0.0');
      });
    });

    describe('array format with fallback patterns', () => {
      it('should use first pattern if it matches tags', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            '3.19.5',
            '3.19',
            '3.18.2',
            '3.18',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: '3.19.5', date: '2024-01-03' },
            { name: '3.19', date: '2024-01-02' },
            { name: '3.18.2', date: '2024-01-01' },
            { name: '3.18', date: '2024-01-01' },
          ]),
        });

        // First pattern *.*.* matches, so it should be used (not fallback to *.*)
        const latest = await resolveLatestTag(mockAPI, ['*.*.*', '*.*']);
        expect(latest).toBe('3.19.5');
      });

      it('should fallback to second pattern if first matches no tags', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            '3.19',
            '3.18',
            'edge-e9613ab3-ls213',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: '3.19', date: '2024-01-02' },
            { name: '3.18', date: '2024-01-01' },
            { name: 'edge-e9613ab3-ls213', date: '2024-01-03' },
          ]),
        });

        // First pattern *.*.* matches nothing, should fallback to *.*
        const latest = await resolveLatestTag(mockAPI, ['*.*.*', '*.*']);
        expect(latest).toBe('3.19');
      });

      it('should throw error if no patterns match', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllTagNames: jest.fn().mockResolvedValue([
            'edge-e9613ab3-ls213',
            'latest',
            'dev',
          ]),
          getAllTags: jest.fn().mockResolvedValue([
            { name: 'edge-e9613ab3-ls213', date: '2024-01-03' },
            { name: 'latest', date: '2024-01-02' },
            { name: 'dev', date: '2024-01-01' },
          ]),
        });

        // None of the patterns match (all require dots)
        await expect(resolveLatestTag(mockAPI, ['*.*.*', '*.*'])).rejects.toThrow(
          'No tags found matching any format pattern'
        );
      });
    });

    describe('release resolution', () => {
      it('should return latest release', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllReleases: jest.fn().mockResolvedValue([
            { name: '1.0.0', date: '2024-01-01' },
            { name: '2.0.0', date: '2024-01-02' },
            { name: '1.5.0', date: '2024-01-03' },
          ]),
        });

        const latest = await resolveLatestTag(mockAPI, undefined, 'release');
        expect(latest).toBe('2.0.0');
      });

      it('should throw error when no releases found', async () => {
        const mockAPI = createMockPlatformAPI({
          getAllReleases: jest.fn().mockResolvedValue([]),
        });

        await expect(resolveLatestTag(mockAPI, undefined, 'release')).rejects.toThrow('No releases found');
      });
    });
  });

  describe('draft and prerelease handling', () => {
    // Modelled on the real n8n release feed, which is what exposed this: a
    // moving `stable` release, a parallel 2.40.x prerelease line and a 1.123.x
    // LTS line all published within minutes of the current stable release.
    const n8nReleases: ReleaseSummary[] = [
      { name: 'stable', date: '2026-09-21T07:41:34Z', isDraft: false, isPrerelease: false },
      { name: 'n8n@2.39.9', date: '2026-09-21T07:41:33Z', isDraft: false, isPrerelease: false },
      { name: 'n8n@2.40.4', date: '2026-09-21T07:32:15Z', isDraft: false, isPrerelease: true },
      { name: 'beta', date: '2026-09-21T07:32:17Z', isDraft: false, isPrerelease: true },
      { name: 'n8n@1.123.81', date: '2026-09-17T07:59:31Z', isDraft: false, isPrerelease: false },
      { name: 'n8n@2.39.8', date: '2026-09-18T07:54:04Z', isDraft: false, isPrerelease: false },
    ];

    it('should resolve the highest stable release, not the newest by date', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllReleases: jest.fn().mockResolvedValue(n8nReleases),
      });

      const latest = await resolveLatestTag(mockAPI, undefined, 'release');

      // Before the fix this returned 'stable' -- the most recent by date, and a
      // moving target that no changelog or version parser can resolve.
      expect(latest).toBe('n8n@2.39.9');
    });

    it('should not select a prerelease by default', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllReleases: jest.fn().mockResolvedValue([
          { name: 'n8n@2.39.9', date: '2026-09-21T07:41:33Z', isPrerelease: false },
          { name: 'n8n@2.40.4', date: '2026-09-21T07:32:15Z', isPrerelease: true },
        ]),
      });

      expect(await resolveLatestTag(mockAPI, undefined, 'release')).toBe('n8n@2.39.9');
    });

    it('should select a prerelease when include-prereleases is set', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllReleases: jest.fn().mockResolvedValue([
          { name: 'n8n@2.39.9', date: '2026-09-21T07:41:33Z', isPrerelease: false },
          { name: 'n8n@2.40.4', date: '2026-09-21T07:32:15Z', isPrerelease: true },
        ]),
      });

      expect(await resolveLatestTag(mockAPI, undefined, 'release', true)).toBe('n8n@2.40.4');
    });

    it('should never select a draft, even with include-prereleases', async () => {
      const mockAPI = createMockPlatformAPI({
        getAllReleases: jest.fn().mockResolvedValue([
          { name: 'v1.0.0', date: '2026-01-01T00:00:00Z', isDraft: false },
          { name: 'v9.9.9', date: '2026-02-01T00:00:00Z', isDraft: true },
        ]),
      });

      expect(await resolveLatestTag(mockAPI, undefined, 'release', true)).toBe('v1.0.0');
    });

    it('should leave tag resolution untouched (tags have no draft state)', async () => {
      const getAllReleases = jest.fn();
      const mockAPI = createMockPlatformAPI({
        getAllTagNames: jest.fn().mockResolvedValue(['n8n@1.0.0', 'n8n@2.0.0']),
        getAllReleases,
      });

      expect(await resolveLatestTag(mockAPI, undefined, 'tags')).toBe('n8n@2.0.0');
      expect(getAllReleases).not.toHaveBeenCalled();
    });
  });

  describe('filterPublishedReleases', () => {
    it('should drop drafts and prereleases by default', () => {
      const result = filterPublishedReleases(
        [
          { name: 'a', date: '', isDraft: false, isPrerelease: false },
          { name: 'b', date: '', isDraft: true, isPrerelease: false },
          { name: 'c', date: '', isDraft: false, isPrerelease: true },
        ],
        false
      );
      expect(result.map((r) => r.name)).toEqual(['a']);
    });

    it('should treat missing flags as published (forges without the concept)', () => {
      // Bitbucket has no releases and reports tags here, with neither flag set.
      const result = filterPublishedReleases(
        [{ name: 'v1.0.0', date: '' }, { name: 'v2.0.0', date: '' }],
        false
      );
      expect(result.map((r) => r.name)).toEqual(['v1.0.0', 'v2.0.0']);
    });

    it('should fall back rather than report no releases when all are prereleases', () => {
      // A pre-1.0 project may mark every release a prerelease; resolving that to
      // "no releases found in repository" would be actively misleading.
      const all: ReleaseSummary[] = [
        { name: 'v0.1.0', date: '', isPrerelease: true },
        { name: 'v0.2.0', date: '', isPrerelease: true },
      ];
      expect(filterPublishedReleases(all, false).map((r) => r.name)).toEqual([
        'v0.1.0',
        'v0.2.0',
      ]);
    });

    it('should still exclude drafts in that fallback', () => {
      const all: ReleaseSummary[] = [
        { name: 'v0.1.0', date: '', isPrerelease: true },
        { name: 'v0.9.9', date: '', isPrerelease: true, isDraft: true },
      ];
      expect(filterPublishedReleases(all, false).map((r) => r.name)).toEqual(['v0.1.0']);
    });
  });

});
