"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNotOptionLike = assertNotOptionLike;
exports.getAllTags = getAllTags;
exports.getTagInfo = getTagInfo;
const child_process_1 = require("child_process");
const types_1 = require("./types");
/**
 * Reject a value git would read as an option rather than as data.
 *
 * Passing arguments as an array stops the SHELL interpreting them, but git still parses a
 * leading "-" as an option, and some of those options run commands — `--upload-pack=<cmd>`
 * being the obvious one. Refnames beginning with "-" are legal as far as
 * `git check-ref-format` is concerned, so this has to be checked rather than assumed.
 */
function assertNotOptionLike(value, label) {
    if (value.startsWith('-')) {
        throw new Error(`Refusing to pass a ${label} beginning with "-" to git: ${JSON.stringify(value)}. ` +
            'git would read it as an option, and options such as --upload-pack=<command> execute commands.');
    }
}
/**
 * Execute a git command and return its output.
 *
 * Takes an argument ARRAY and uses execFileSync, so no shell is involved and nothing in
 * the arguments can be interpreted as syntax. This previously built a single string and
 * ran it through execSync, which meant any tag name containing shell metacharacters —
 * all of which git accepts in a refname, and all of which match an `on: push: tags: ['v*']`
 * trigger — executed as a command on the runner.
 *
 * It also broke ordinary use: `--format=%(contents)` contains parentheses, which are shell
 * syntax, so reading an annotated tag's message always failed and returned empty.
 */
function execGit(args, repoPath) {
    try {
        return (0, child_process_1.execFileSync)('git', args, {
            cwd: repoPath,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        })
            .toString()
            .trim();
    }
    catch (error) {
        throw new Error(`Git command failed: git ${args.join(' ')} - ${error}`);
    }
}
/**
 * Check if tag exists locally
 */
function tagExists(tagName, repoPath) {
    try {
        execGit(['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`], repoPath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get tag SHA
 */
function getTagSha(tagName, repoPath) {
    return execGit(['rev-parse', `refs/tags/${tagName}`], repoPath);
}
/**
 * Get commit SHA that tag points to
 */
function getTagCommitSha(tagName, repoPath) {
    // For annotated tags, get the commit SHA
    // For lightweight tags, the tag SHA is the commit SHA
    try {
        // Try to get the commit SHA (works for both annotated and lightweight tags)
        return execGit(['rev-parse', `refs/tags/${tagName}^{commit}`], repoPath);
    }
    catch {
        // Fallback: tag might be the commit itself
        return getTagSha(tagName, repoPath);
    }
}
/**
 * Check if tag is annotated
 */
function isAnnotatedTag(tagName, repoPath) {
    try {
        const tagType = execGit(['cat-file', '-t', `refs/tags/${tagName}`], repoPath);
        return tagType === 'tag';
    }
    catch {
        return false;
    }
}
/**
 * Get tag message
 */
function getTagMessage(tagName, repoPath) {
    try {
        if (isAnnotatedTag(tagName, repoPath)) {
            // For annotated tags, get the tag message
            return execGit(['tag', '-l', '--format=%(contents)', tagName], repoPath);
        }
        else {
            // For lightweight tags, there's no message
            return '';
        }
    }
    catch {
        return '';
    }
}
/**
 * Get all tags from repository
 */
function getAllTags(repoPath) {
    try {
        const tags = execGit(['tag', '-l'], repoPath);
        return tags ? tags.split('\n').filter((tag) => tag.trim().length > 0) : [];
    }
    catch {
        return [];
    }
}
/**
 * Get tag information from local repository
 */
function getTagInfo(tagName, repoPath) {
    assertNotOptionLike(tagName, 'tag name');
    if (!tagExists(tagName, repoPath)) {
        return {
            exists: false,
            name: tagName,
            item_sha: '',
            item_type: types_1.ItemType.COMMIT,
            commit_sha: '',
            details: '',
            verified: false,
            is_draft: false,
            is_prerelease: false,
        };
    }
    const tagSha = getTagSha(tagName, repoPath);
    const commitSha = getTagCommitSha(tagName, repoPath);
    const isAnnotated = isAnnotatedTag(tagName, repoPath);
    const tagMessage = getTagMessage(tagName, repoPath);
    // GPG verification (if tag is signed)
    let verified = false;
    try {
        execGit(['verify-tag', `refs/tags/${tagName}`], repoPath);
        verified = true;
    }
    catch {
        // Tag is not verified or verification failed
        verified = false;
    }
    return {
        exists: true,
        name: tagName,
        item_sha: tagSha,
        item_type: isAnnotated ? types_1.ItemType.TAG : types_1.ItemType.COMMIT,
        commit_sha: commitSha,
        details: tagMessage,
        verified,
        is_draft: false,
        is_prerelease: false,
    };
}
//# sourceMappingURL=git-client.js.map