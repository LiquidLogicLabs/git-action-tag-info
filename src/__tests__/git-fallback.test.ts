import { execSync } from 'child_process';
import { tryGitLsRemoteFallback } from '../platforms/git-fallback';
import { Logger } from '../logger';
import { ItemType } from '../types';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock Logger
jest.mock('../logger', () => ({
  Logger: jest.fn().mockImplementation((verbose: boolean = false) => ({
    verbose,
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('git-fallback', () => {
  let mockExecSync: jest.MockedFunction<typeof execSync>;
  let logger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
    logger = new Logger(false);
  });

  describe('tryGitLsRemoteFallback', () => {
    it('should return null when repository URL is not provided', () => {
      const result = tryGitLsRemoteFallback('v1.0.0', undefined, logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('No repository URL available for git ls-remote fallback');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should successfully return tag info when git ls-remote finds the tag', () => {
      const mockOutput = 'abc123def4567890123456789012345678901234\trefs/tags/v1.0.0';
      mockExecSync.mockReturnValue(mockOutput as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toEqual({
        exists: true,
        name: 'v1.0.0',
        item_sha: 'abc123def4567890123456789012345678901234',
        item_type: ItemType.COMMIT,
        commit_sha: 'abc123def4567890123456789012345678901234',
        details: '',
        verified: false,
        is_draft: false,
        is_prerelease: false,
      });

      expect(mockExecSync).toHaveBeenCalledWith(
        'git ls-remote --tags https://github.com/owner/repo refs/tags/v1.0.0',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      expect(logger.debug).toHaveBeenCalledWith('Attempting git ls-remote fallback for tag: v1.0.0');
      expect(logger.debug).toHaveBeenCalledWith(
        'Fallback successful: tag v1.0.0 found via git ls-remote (SHA: abc123def4567890123456789012345678901234)'
      );
    });

    it('should normalize repository URL by removing .git suffix', () => {
      const mockOutput = 'abc123def4567890123456789012345678901234\trefs/tags/v1.0.0';
      mockExecSync.mockReturnValue(mockOutput as any);

      tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(mockExecSync).toHaveBeenCalledWith(
        'git ls-remote --tags https://github.com/owner/repo refs/tags/v1.0.0',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    });

    it('should return null when git ls-remote returns empty output', () => {
      mockExecSync.mockReturnValue('' as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Attempting git ls-remote fallback for tag: v1.0.0');
      expect(logger.debug).toHaveBeenCalledWith('Fallback returned empty result for tag: v1.0.0');
    });

    it('should return null when git ls-remote returns invalid SHA format', () => {
      const mockOutput = 'invalid-sha\trefs/tags/v1.0.0';
      mockExecSync.mockReturnValue(mockOutput as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Fallback returned invalid SHA format: invalid-sha');
    });

    it('should return null when git ls-remote returns SHA shorter than 40 characters', () => {
      const mockOutput = 'abc123\trefs/tags/v1.0.0';
      mockExecSync.mockReturnValue(mockOutput as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Fallback returned invalid SHA format: abc123');
    });

    it('should handle execSync errors gracefully and return null', () => {
      const error = new Error('git ls-remote failed');
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Attempting git ls-remote fallback for tag: v1.0.0');
      expect(logger.debug).toHaveBeenCalledWith('git ls-remote fallback failed: git ls-remote failed');
    });

    it('should handle non-Error exceptions', () => {
      mockExecSync.mockImplementation(() => {
        throw 'String error';
      });

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('git ls-remote fallback failed: String error');
    });

    it('should parse SHA correctly from multi-line output (uses first line)', () => {
      const mockOutput = 'abc123def4567890123456789012345678901234\trefs/tags/v1.0.0\nother-line';
      mockExecSync.mockReturnValue(mockOutput as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      expect(result).not.toBeNull();
      expect(result?.item_sha).toBe('abc123def4567890123456789012345678901234');
    });

    it('should handle output with extra whitespace', () => {
      const mockOutput = '  abc123def4567890123456789012345678901234\trefs/tags/v1.0.0  ';
      mockExecSync.mockReturnValue(mockOutput as any);

      const result = tryGitLsRemoteFallback('v1.0.0', 'https://github.com/owner/repo.git', logger);

      // execSync output is trimmed, but SHA parsing should still work
      expect(result).not.toBeNull();
      expect(result?.item_sha).toBe('abc123def4567890123456789012345678901234');
    });

    it('should work with different repository URL formats', () => {
      const mockOutput = 'abc123def4567890123456789012345678901234\trefs/tags/v1.0.0';
      mockExecSync.mockReturnValue(mockOutput as any);

      const testUrls = [
        'https://github.com/owner/repo',
        'https://github.com/owner/repo.git',
        'git@github.com:owner/repo.git',
        'ssh://git@github.com/owner/repo.git',
      ];

      for (const url of testUrls) {
        mockExecSync.mockClear();
        logger.debug = jest.fn();

        tryGitLsRemoteFallback('v1.0.0', url, logger);

        // Should normalize .git suffix
        const expectedUrl = url.replace(/\.git$/, '');
        expect(mockExecSync).toHaveBeenCalledWith(
          `git ls-remote --tags ${expectedUrl} refs/tags/v1.0.0`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
      }
    });
  });
});
