import { safeSegment } from '../repo-utils';
import { GiteaAPI } from '../platforms/gitea';
import { BitbucketAPI } from '../platforms/bitbucket';
import { HttpClient } from '../platforms/http-client';
import { Logger } from '../logger';
import { Platform } from '../types';
import * as https from 'https';

jest.mock('../platforms/http-client');
jest.mock('https');

/**
 * A value interpolated unencoded into an API path can redirect the request to a different
 * endpoint. Verified against WHATWG URL resolution, which is what both transports in this
 * action apply (`new URL(baseUrl + path)`, then `path: urlObj.pathname + urlObj.search`):
 *
 *   tag = "../../../user"  ->  /repos/o/r/git/refs/tags/../../../user  =>  /repos/o/user
 *   tag = ".."             ->  /repos/o/r/git/refs/tags/..             =>  /repos/o/r/git/refs/
 *
 * The second is the dangerous one: it reads the whole COLLECTION rather than one item, and
 * it is what an attacker reaches by pushing a tag literally named "..".
 *
 * encodeURIComponent alone is NOT sufficient — it does not encode dots, so ".." survives it
 * unchanged. Tests assert the NORMALIZED pathname, because asserting the built string passes
 * while the sink stays open.
 */
const BASE = 'https://api.example.com';
const normalized = (path: string) => new URL(BASE + path).pathname;

const logger = new Logger(false, false);
const repoInfo = { owner: 'o', repo: 'r', platform: Platform.GITEA as Platform | 'auto' };

describe('safeSegment', () => {
  it('encodes slashes so a segment cannot introduce new path levels', () => {
    const path = `/repos/o/r/git/refs/tags/${safeSegment('../../../user', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/git/refs/tags/..%2F..%2F..%2Fuser');
  });

  it.each(['..', '.'])('refuses a bare %s, which encoding alone would not stop', (dots) => {
    expect(() => safeSegment(dots, 'tag')).toThrow(/redirect/i);
  });

  it('encodes a query string so it cannot alter the request', () => {
    const path = `/repos/o/r/releases/tags/${safeSegment('v1?per_page=1', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/releases/tags/v1%3Fper_page%3D1');
    expect(new URL(BASE + path).search).toBe('');
  });

  it('encodes a fragment so the rest of the path is not discarded', () => {
    const path = `/repos/o/r/releases/tags/${safeSegment('v1#x', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/releases/tags/v1%23x');
  });

  it('leaves an ordinary tag readable', () => {
    expect(safeSegment('v1.2.3', 'tag')).toBe('v1.2.3');
    expect(normalized(`/repos/o/r/releases/tags/${safeSegment('v1.2.3', 'tag')}`)).toBe('/repos/o/r/releases/tags/v1.2.3');
  });

  it('names the label so an operator can tell which value was rejected', () => {
    expect(() => safeSegment('..', 'owner')).toThrow(/owner/);
  });
});

/**
 * The unit tests above prove safeSegment is correct; these prove the call sites actually use
 * it. A fix that wraps only some of the interpolated values passes the first set and fails
 * these.
 */
describe('Gitea call sites', () => {
  const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
  let paths: string[];

  const giteaConfig = {
    type: Platform.GITEA,
    baseUrl: 'https://gitea.example.com/api/v1',
    token: 't',
    ignoreCertErrors: false,
    verbose: false
  };

  // The path the transport would really send, after WHATWG normalization.
  const sentPaths = () => paths.map((p) => new URL('https://gitea.example.com/api/v1' + p).pathname);

  const mockGet = (responder: (path: string) => { statusCode: number; body: string }) => {
    MockedHttpClient.mockImplementation(
      () =>
        ({
          get: jest.fn(async (path: string) => {
            paths.push(path);
            return { headers: {}, ...responder(path) };
          })
        }) as unknown as HttpClient
    );
  };

  beforeEach(() => {
    paths = [];
    MockedHttpClient.mockReset();
  });

  it('encodes the tag name in getTagInfo', async () => {
    mockGet(() => ({ statusCode: 200, body: JSON.stringify({ object: { sha: 'abc', type: 'commit' } }) }));
    await new GiteaAPI(repoInfo, giteaConfig, logger).getTagInfo('../../../user');
    expect(sentPaths()).toEqual(['/api/v1/repos/o/r/git/refs/tags/..%2F..%2F..%2Fuser']);
  });

  it('refuses a bare .. tag rather than reading the whole refs collection', async () => {
    mockGet(() => ({ statusCode: 200, body: '{}' }));
    await expect(new GiteaAPI(repoInfo, giteaConfig, logger).getTagInfo('..')).rejects.toThrow(/redirect/i);
    expect(paths).toEqual([]);
  });

  it('encodes the owner and repo, which come from the user-supplied repository input', async () => {
    mockGet(() => ({ statusCode: 200, body: JSON.stringify({ object: { sha: 'abc', type: 'commit' } }) }));
    const hostile = { owner: '../../../user', repo: 'r', platform: Platform.GITEA as Platform | 'auto' };
    await new GiteaAPI(hostile, giteaConfig, logger).getTagInfo('v1');
    expect(sentPaths()).toEqual(['/api/v1/repos/..%2F..%2F..%2Fuser/r/git/refs/tags/v1']);
  });

  it('encodes the annotated-tag object SHA, which is a server-supplied response field', async () => {
    mockGet((p) =>
      p.includes('/git/refs/tags/')
        ? { statusCode: 200, body: JSON.stringify({ object: { sha: '../../../user', type: 'tag' } }) }
        : { statusCode: 200, body: JSON.stringify({ object: { sha: 'abc' }, message: 'm' }) }
    );
    await new GiteaAPI(repoInfo, giteaConfig, logger).getTagInfo('v1');
    expect(sentPaths()[1]).toBe('/api/v1/repos/o/r/git/tags/..%2F..%2F..%2Fuser');
  });

  it('encodes releaseData.tag_name, which is a server-supplied response field', async () => {
    mockGet((p) =>
      p.includes('/releases/tags/')
        ? { statusCode: 200, body: JSON.stringify({ tag_name: '../../../user', name: 'n' }) }
        : { statusCode: 200, body: JSON.stringify({ object: { sha: 'abc', type: 'commit' } }) }
    );
    await new GiteaAPI(repoInfo, giteaConfig, logger).getReleaseInfo('v1');
    expect(sentPaths()[1]).toBe('/api/v1/repos/o/r/git/refs/tags/..%2F..%2F..%2Fuser');
  });
});

describe('Bitbucket call sites', () => {
  const bitbucketConfig = {
    type: Platform.BITBUCKET,
    baseUrl: 'https://api.bitbucket.org/2.0',
    token: 't',
    ignoreCertErrors: false,
    verbose: false
  };
  let requested: string[];

  beforeEach(() => {
    requested = [];
    (https.request as unknown as jest.Mock).mockImplementation((options: https.RequestOptions, cb: (res: unknown) => void) => {
      requested.push(String(options.path));
      const res = {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {},
        on: (event: string, handler: (chunk?: string) => void) => {
          if (event === 'data') handler(JSON.stringify({ target: { hash: 'abc' } }));
          if (event === 'end') handler();
          return res;
        }
      };
      process.nextTick(() => cb(res));
      return { on: () => undefined, end: () => undefined };
    });
  });

  it('encodes the tag name in getTagInfo', async () => {
    await new BitbucketAPI({ ...repoInfo, platform: Platform.BITBUCKET }, bitbucketConfig, logger).getTagInfo('../../../user');
    expect(requested).toEqual(['/2.0/repositories/o/r/refs/tags/..%2F..%2F..%2Fuser']);
  });

  it('refuses a bare .. tag rather than reading the whole tags collection', async () => {
    await expect(new BitbucketAPI({ ...repoInfo, platform: Platform.BITBUCKET }, bitbucketConfig, logger).getTagInfo('..')).rejects.toThrow(/redirect/i);
    expect(requested).toEqual([]);
  });

  it('encodes the owner and repo, which come from the user-supplied repository input', async () => {
    const hostile = { owner: 'o', repo: '../../../user', platform: Platform.BITBUCKET as Platform | 'auto' };
    await new BitbucketAPI(hostile, bitbucketConfig, logger).getTagInfo('v1');
    expect(requested).toEqual(['/2.0/repositories/o/..%2F..%2F..%2Fuser/refs/tags/v1']);
  });
});
