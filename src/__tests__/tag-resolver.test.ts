import { resolveLatestTag } from '../tag-resolver';
import { RepoConfig, Platform } from '../types';
import * as gitClient from '../git-client';
import * as githubClient from '../github-client';
import * as giteaClient from '../gitea-client';
import * as bitbucketClient from '../bitbucket-client';

// Mock the client modules
jest.mock('../git-client');
jest.mock('../github-client');
jest.mock('../gitea-client');
jest.mock('../bitbucket-client');

describe('tag-resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveLatestTag', () => {
    it('should return highest semver tag when semver tags exist', async () => {
      const config: RepoConfig = {
        type: 'remote',
        platform: Platform.GITHUB,
        owner: 'owner',
        repo: 'repo',
      };

      (githubClient.getAllTags as jest.Mock).mockResolvedValue([
        { name: '1.0.0', date: '2024-01-01' },
        { name: '2.0.0', date: '2024-01-02' },
        { name: '1.5.0', date: '2024-01-03' },
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('2.0.0');
    });

    it('should fallback to date when no semver tags exist', async () => {
      const config: RepoConfig = {
        type: 'remote',
        platform: Platform.GITHUB,
        owner: 'owner',
        repo: 'repo',
      };

      (githubClient.getAllTags as jest.Mock).mockResolvedValue([
        { name: 'release-1', date: '2024-01-01T00:00:00Z' },
        { name: 'release-2', date: '2024-01-03T00:00:00Z' },
        { name: 'release-3', date: '2024-01-02T00:00:00Z' },
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('release-2'); // Most recent by date
    });

    it('should work with local repositories', async () => {
      const config: RepoConfig = {
        type: 'local',
        path: '/path/to/repo',
      };

      (gitClient.getAllTags as jest.Mock).mockReturnValue([
        'v2.0.0',
        'v1.5.0',
        'v1.0.0',
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('v2.0.0');
    });

    it('should work with Gitea repositories', async () => {
      const config: RepoConfig = {
        type: 'remote',
        platform: Platform.GITEA,
        owner: 'owner',
        repo: 'repo',
        baseUrl: 'https://gitea.example.com',
      };

      (giteaClient.getAllTags as jest.Mock).mockResolvedValue([
        { name: '1.0.0', date: '2024-01-01' },
        { name: '2.0.0', date: '2024-01-02' },
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('2.0.0');
    });

    it('should work with Bitbucket repositories', async () => {
      const config: RepoConfig = {
        type: 'remote',
        platform: Platform.BITBUCKET,
        owner: 'owner',
        repo: 'repo',
      };

      (bitbucketClient.getAllTags as jest.Mock).mockResolvedValue([
        { name: '1.0.0', date: '2024-01-01' },
        { name: '2.0.0', date: '2024-01-02' },
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('2.0.0');
    });

    it('should throw error when no tags found', async () => {
      const config: RepoConfig = {
        type: 'remote',
        platform: Platform.GITHUB,
        owner: 'owner',
        repo: 'repo',
      };

      (githubClient.getAllTags as jest.Mock).mockResolvedValue([]);

      await expect(resolveLatestTag(config)).rejects.toThrow('No tags found');
    });

    it('should use alphabetical fallback when no dates available', async () => {
      const config: RepoConfig = {
        type: 'local',
        path: '/path/to/repo',
      };

      (gitClient.getAllTags as jest.Mock).mockReturnValue([
        'tag-a',
        'tag-z',
        'tag-m',
      ]);

      const latest = await resolveLatestTag(config);
      expect(latest).toBe('tag-z'); // Last alphabetically
    });

    describe('format filtering', () => {
      it('should filter tags by X.X format before semver sorting', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          '3.23-bae0df8a-ls3',
          '3.22-c210e9fe-ls18',
          'edge-e9613ab3-ls213',
          '3.21-633fbea2-ls27',
        ]);

        // Mock getAllTags as fallback (though it shouldn't be called in this case)
        (githubClient.getAllTags as jest.Mock).mockResolvedValue([
          { name: '3.23-bae0df8a-ls3', date: '2024-01-03' },
          { name: '3.22-c210e9fe-ls18', date: '2024-01-02' },
          { name: 'edge-e9613ab3-ls213', date: '2024-01-04' },
          { name: '3.21-633fbea2-ls27', date: '2024-01-01' },
        ]);

        const latest = await resolveLatestTag(config, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3'); // Highest semver among filtered tags
      });

      it('should filter tags by X.X format and use date sorting when no semver', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          'edge-e9613ab3-ls213',
          '3.23-bae0df8a-ls3',
          '3.22-c210e9fe-ls18',
        ]);

        (githubClient.getAllTags as jest.Mock).mockResolvedValue([
          { name: 'edge-e9613ab3-ls213', date: '2024-01-03T00:00:00Z' },
          { name: '3.23-bae0df8a-ls3', date: '2024-01-02T00:00:00Z' },
          { name: '3.22-c210e9fe-ls18', date: '2024-01-01T00:00:00Z' },
        ]);

        const latest = await resolveLatestTag(config, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3'); // Most recent by date among filtered tags
      });

      it('should filter tags by X.X.X format', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          '1.2.3',
          '1.2.3-alpha',
          '2.0.0',
          'edge-e9613ab3-ls213',
          '3.23-bae0df8a-ls3',
        ]);

        const latest = await resolveLatestTag(config, 'X.X.X');
        expect(latest).toBe('2.0.0'); // Highest semver among X.X.X tags
      });

      it('should filter tags by regex format', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          'v1.2.3',
          'v2.0.0',
          '1.2.3',
          'edge-e9613ab3-ls213',
        ]);

        const latest = await resolveLatestTag(config, '^v\\d+\\.\\d+\\.\\d+$');
        expect(latest).toBe('v2.0.0'); // Highest semver among v-prefixed tags
      });

      it('should throw error when no tags match format', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          'edge-e9613ab3-ls213',
          'latest',
          'dev',
        ]);

        await expect(resolveLatestTag(config, 'X.X')).rejects.toThrow(
          'No tags found matching format pattern'
        );
      });

      it('should work with format filtering on local repositories', async () => {
        const config: RepoConfig = {
          type: 'local',
          path: '/path/to/repo',
        };

        (gitClient.getAllTags as jest.Mock).mockReturnValue([
          '3.23-bae0df8a-ls3',
          '3.22-c210e9fe-ls18',
          'edge-e9613ab3-ls213',
          '3.21-633fbea2-ls27',
        ]);

        const latest = await resolveLatestTag(config, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3');
      });

      it('should work with format filtering on Gitea repositories', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITEA,
          owner: 'owner',
          repo: 'repo',
          baseUrl: 'https://gitea.example.com',
        };

        (giteaClient.getAllTags as jest.Mock).mockResolvedValue([
          { name: '3.23-bae0df8a-ls3', date: '2024-01-02' },
          { name: '3.22-c210e9fe-ls18', date: '2024-01-01' },
          { name: 'edge-e9613ab3-ls213', date: '2024-01-03' },
        ]);

        const latest = await resolveLatestTag(config, 'X.X');
        expect(latest).toBe('3.23-bae0df8a-ls3');
      });

      it('should preserve backward compatibility when format is not provided', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTags as jest.Mock).mockResolvedValue([
          { name: '1.0.0', date: '2024-01-01' },
          { name: '2.0.0', date: '2024-01-02' },
          { name: '1.5.0', date: '2024-01-03' },
        ]);

        // Without format - should behave as before
        const latest = await resolveLatestTag(config);
        expect(latest).toBe('2.0.0');
      });

      it('should filter before applying semver sorting', async () => {
        const config: RepoConfig = {
          type: 'remote',
          platform: Platform.GITHUB,
          owner: 'owner',
          repo: 'repo',
        };

        (githubClient.getAllTagNames as jest.Mock).mockResolvedValue([
          '1.0.0', // Semver but doesn't match X.X
          '3.23-bae0df8a-ls3', // Matches X.X
          '2.0.0', // Semver but doesn't match X.X
          '3.22-c210e9fe-ls18', // Matches X.X
        ]);

        // Mock getAllTags as fallback
        (githubClient.getAllTags as jest.Mock).mockResolvedValue([
          { name: '1.0.0', date: '2024-01-01' },
          { name: '3.23-bae0df8a-ls3', date: '2024-01-03' },
          { name: '2.0.0', date: '2024-01-02' },
          { name: '3.22-c210e9fe-ls18', date: '2024-01-01' },
        ]);

        const latest = await resolveLatestTag(config, 'X.X');
        // Should return highest among X.X tags, not highest semver overall
        expect(latest).toBe('3.23-bae0df8a-ls3');
      });
    });
  });
});

