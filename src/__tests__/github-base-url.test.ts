import { createPlatformAPI } from '../platforms/platform-factory';
import { determineBaseUrl } from '../platforms/github';
import { Logger } from '../logger';
import { Platform } from '../types';

/**
 * A Gitea Actions runner (gitea/runner 6) exports GITEA_API_URL, e.g. http://gitea:3000/api/v1.
 * The factory adds it to the candidate URLs, and the GitHub base-URL picker took the first
 * candidate whose path contains "/api" - so a lookup of a github.com repository was sent to
 * Gitea, which answered 401 "invalid username, password or token". Seen 2026-11-24..27 on every
 * upstream-tag-sync that reads GitHub releases from a Gitea runner.
 */
describe('GitHub API base URL', () => {
  const saved = { ...process.env };
  const logger = new Logger(false, false);

  beforeEach(() => {
    process.env.GITHUB_SERVER_URL = 'http://gitea:3000';
    process.env.GITEA_SERVER_URL = 'http://gitea:3000';
    process.env.GITEA_API_URL = 'http://gitea:3000/api/v1';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const repoInfo = {
    owner: 'linuxserver',
    repo: 'docker-baseimage-ubuntu',
    platform: Platform.GITHUB as Platform | 'auto',
    url: 'https://github.com/linuxserver/docker-baseimage-ubuntu',
  };
  const config = { token: 't', ignoreCertErrors: false, verbose: false };

  it('ignores a Gitea API URL from the runner environment', async () => {
    const { baseUrl } = await createPlatformAPI(repoInfo, Platform.GITHUB, config, logger);
    expect(baseUrl).toBe('https://api.github.com');
  });

  it('honours an explicit base-url', async () => {
    const { baseUrl } = await createPlatformAPI(
      repoInfo,
      Platform.GITHUB,
      { ...config, baseUrl: 'https://ghe.example.com/api/v3' },
      logger
    );
    expect(baseUrl).toBe('https://ghe.example.com/api/v3');
  });

  it.each([
    [['http://gitea:3000/api/v1'], 'https://api.github.com'],
    [['https://gitea.example.com/api/v1', 'https://github.com/o/r'], 'https://api.github.com'],
    [['https://api.github.com'], 'https://api.github.com'],
    [['https://ghe.example.com/api/v3'], 'https://ghe.example.com/api/v3'],
    [['https://ghe.example.com/api/v3/'], 'https://ghe.example.com/api/v3'],
    [[], 'https://api.github.com'],
  ])('determineBaseUrl(%j) -> %s', (urls, expected) => {
    expect(determineBaseUrl(urls)).toBe(expected);
  });
});
