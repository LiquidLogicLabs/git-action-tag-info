import { GiteaAPI } from '../platforms/gitea';
import { HttpClient } from '../platforms/http-client';
import { tryGitLsRemoteFallback } from '../platforms/git-fallback';
import { Logger } from '../logger';
import { ItemType, Platform } from '../types';

jest.mock('../platforms/http-client');
jest.mock('../platforms/git-fallback');

/**
 * Gitea's GET /repos/{owner}/{repo}/git/refs/tags/{tag} answers with an ARRAY of every ref
 * whose name starts with the requested one (observed on Gitea 1.24: `tags/v3` returns v3,
 * v3.6, v3.7, ...). Reading `.object` off that array yields undefined, so an annotated tag
 * came back as item-type commit with an empty commit SHA and no message, and a missing tag
 * was reported as existing whenever a longer tag shared its prefix.
 */
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const mockedFallback = tryGitLsRemoteFallback as jest.MockedFunction<typeof tryGitLsRemoteFallback>;

const logger = new Logger(false, false);
const repoInfo = {
  owner: 'o',
  repo: 'r',
  platform: Platform.GITEA as Platform | 'auto',
  url: 'https://gitea.example.com/o/r',
};
const config = {
  type: Platform.GITEA,
  baseUrl: 'https://gitea.example.com/api/v1',
  token: 't',
  ignoreCertErrors: false,
  verbose: false,
};

const ref = (name: string, type: 'tag' | 'commit', sha: string) => ({
  ref: `refs/tags/${name}`,
  object: { type, sha },
});

let routes: Record<string, unknown>;

beforeEach(() => {
  MockedHttpClient.mockReset();
  mockedFallback.mockReset();
  mockedFallback.mockReturnValue(null);
  MockedHttpClient.mockImplementation(
    () =>
      ({
        get: jest.fn(async (path: string) =>
          path in routes
            ? { statusCode: 200, headers: {}, body: JSON.stringify(routes[path]) }
            : { statusCode: 404, headers: {}, body: '{"message":"not found"}' }
        ),
      }) as unknown as HttpClient
  );
});

describe('Gitea getTagInfo with prefix-matched ref arrays', () => {
  it('reads the annotated tag that exactly matches, not the first prefix match', async () => {
    routes = {
      '/repos/o/r/git/refs/tags/v3': [ref('v3', 'tag', 'tagobj3'), ref('v3.6', 'tag', 'tagobj36')],
      '/repos/o/r/git/tags/tagobj3': {
        object: { sha: 'commit3' },
        message: 'Mirror upstream v3\n\nnotes',
      },
    };

    const info = await new GiteaAPI(repoInfo, config, logger).getTagInfo('v3');

    expect(info).toMatchObject({
      exists: true,
      item_type: ItemType.TAG,
      item_sha: 'tagobj3',
      commit_sha: 'commit3',
      details: 'Mirror upstream v3\n\nnotes',
    });
  });

  it('finds the exact match when it is not first in the array', async () => {
    routes = {
      '/repos/o/r/git/refs/tags/v3.7.1': [
        ref('v3.7.1-rc1', 'commit', 'rc'),
        ref('v3.7.1', 'commit', 'c371'),
      ],
    };

    const info = await new GiteaAPI(repoInfo, config, logger).getTagInfo('v3.7.1');

    expect(info).toMatchObject({ exists: true, item_type: ItemType.COMMIT, commit_sha: 'c371' });
  });

  it('reports a tag missing when only longer tags share its prefix', async () => {
    routes = {
      '/repos/o/r/git/refs/tags/v3.7.1': [ref('v3.7.14', 'tag', 'tagobj3714')],
    };

    const info = await new GiteaAPI(repoInfo, config, logger).getTagInfo('v3.7.1');

    expect(info.exists).toBe(false);
    expect(mockedFallback).toHaveBeenCalledWith('v3.7.1', repoInfo.url, logger);
  });

  it('still accepts a single ref object', async () => {
    routes = {
      '/repos/o/r/git/refs/tags/v1': ref('v1', 'commit', 'c1'),
    };

    const info = await new GiteaAPI(repoInfo, config, logger).getTagInfo('v1');

    expect(info).toMatchObject({ exists: true, commit_sha: 'c1' });
  });
});

describe('Gitea getReleaseInfo with prefix-matched ref arrays', () => {
  it('resolves the release tag SHAs from the exact ref', async () => {
    routes = {
      '/repos/o/r/releases/tags/v3': { tag_name: 'v3', body: 'release notes' },
      '/repos/o/r/git/refs/tags/v3': [ref('v3', 'tag', 'tagobj3'), ref('v3.6', 'commit', 'c36')],
      '/repos/o/r/git/tags/tagobj3': { object: { sha: 'commit3' }, message: 'm' },
    };

    const info = await new GiteaAPI(repoInfo, config, logger).getReleaseInfo('v3');

    expect(info).toMatchObject({
      exists: true,
      item_sha: 'tagobj3',
      commit_sha: 'commit3',
      details: 'release notes',
    });
  });
});
