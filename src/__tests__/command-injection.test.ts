import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getTagInfo } from '../git-client';
import { tryGitLsRemoteFallback } from '../platforms/git-fallback';
import { Logger } from '../logger';

/**
 * These are exploit tests, not style checks. Each one names a tag (or a repository URL)
 * that git itself accepts and that a shell would treat as a command, then asserts the
 * command did not run. `git check-ref-format` accepts every payload used here, and all of
 * them match an `on: push: tags: ['v*']` trigger, so anyone who can push a tag reaches
 * this code.
 */
describe('command injection', () => {
  let repo: string;
  let marker: string;
  const logger = new Logger(false, false);

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'inj-repo-'));
    marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inj-mark-')), 'pwned');
    execFileSync('git', ['init', '-q', '.'], { cwd: repo });
    execFileSync('git', ['config', 'user.email', 't@t.t'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: repo });
    execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'c'], { cwd: repo });
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.dirname(marker), { recursive: true, force: true });
  });

  // Each payload is a legal git refname that a shell would split into a second command.
  // They use redirection rather than `touch <path>` because a refname may not contain a
  // space, which is exactly why this is easy to under-estimate: the payloads that fit the
  // rules still get a shell to write a file.
  const payloads = [
    ['semicolon', (m: string) => `v1.0.0;id>${m}`],
    ['pipe', (m: string) => `v1.0.0|id>${m}`],
    ['command substitution', (m: string) => `v1.0.0$(id>${m})`],
    ['backticks', (m: string) => `v1.0.0\`id>${m}\``],
    // `||` rather than `&&`: the shell truncates the refname at the operator, so git is
    // handed a ref that does not exist and fails — which is precisely when `||` fires.
    ['or operator', (m: string) => `v1.0.0||id>${m}`],
  ] as const;

  describe.each(payloads)('tag name using %s', (_label, build) => {
    it('does not execute the injected command', () => {
      const tagName = build(marker);
      // Sanity: git must actually accept this as a refname, or the test proves nothing.
      execFileSync('git', ['check-ref-format', `refs/tags/${tagName}`]);
      execFileSync('git', ['tag', tagName], { cwd: repo });

      getTagInfo(tagName, repo);

      expect(fs.existsSync(marker)).toBe(false);
    });
  });

  it('does not execute an injected command through the ls-remote fallback', () => {
    tryGitLsRemoteFallback(`v1.0.0;id>${marker}`, repo, logger);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('does not let a repository URL smuggle in a git option', () => {
    // execFile alone does not close this: --upload-pack is its own argv element and git
    // runs it. Verified against real git — the injected command executes and its output
    // is fed back to git as protocol data.
    tryGitLsRemoteFallback('v1.0.0', `--upload-pack=id>${marker}`, logger);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('still reads a normal tag correctly', () => {
    execFileSync('git', ['tag', '-a', 'v1.2.3', '-m', 'release notes'], { cwd: repo });

    const info = getTagInfo('v1.2.3', repo);

    expect(info.exists).toBe(true);
    expect(info.name).toBe('v1.2.3');
    expect(info.commit_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(info.details).toContain('release notes');
  });
});
