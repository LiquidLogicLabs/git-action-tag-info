import { resolveLatestTag } from '../tag-resolver';
import { PlatformAPI } from '../types';

// Create mock PlatformAPI
function createMockPlatformAPI(mocks: {
  getAllTagNames?: () => Promise<string[]>;
  getAllTags?: () => Promise<Array<{ name: string; date: string }>>;
  getAllReleaseNames?: () => Promise<string[]>;
  getAllReleases?: () => Promise<Array<{ name: string; date: string }>>;
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
});
