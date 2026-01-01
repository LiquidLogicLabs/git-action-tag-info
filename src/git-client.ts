import { execSync } from 'child_process';
import { ItemInfo, ItemType } from './types';

/**
 * Execute git command and return output
 */
function execGit(command: string, repoPath: string): string {
  try {
    return execSync(`git ${command}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .toString()
      .trim();
  } catch (error) {
    throw new Error(`Git command failed: git ${command} - ${error}`);
  }
}

/**
 * Check if tag exists
 */
function tagExists(tagName: string, repoPath: string): boolean {
  try {
    execGit(`rev-parse --verify --quiet refs/tags/${tagName}`, repoPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tag SHA
 */
function getTagSha(tagName: string, repoPath: string): string {
  return execGit(`rev-parse refs/tags/${tagName}`, repoPath);
}

/**
 * Get commit SHA that tag points to
 */
function getTagCommitSha(tagName: string, repoPath: string): string {
  // For annotated tags, get the commit SHA
  // For lightweight tags, the tag SHA is the commit SHA
  try {
    // Try to get the commit SHA (works for both annotated and lightweight tags)
    return execGit(`rev-parse ${tagName}^{commit}`, repoPath);
  } catch {
    // Fallback: tag might be the commit itself
    return getTagSha(tagName, repoPath);
  }
}

/**
 * Check if tag is annotated
 */
function isAnnotatedTag(tagName: string, repoPath: string): boolean {
  try {
    const tagType = execGit(`cat-file -t refs/tags/${tagName}`, repoPath);
    return tagType === 'tag';
  } catch {
    return false;
  }
}

/**
 * Get tag message
 */
function getTagMessage(tagName: string, repoPath: string): string {
  try {
    if (isAnnotatedTag(tagName, repoPath)) {
      // For annotated tags, get the tag message
      return execGit(`tag -l --format=%(contents) ${tagName}`, repoPath);
    } else {
      // For lightweight tags, there's no message
      return '';
    }
  } catch {
    return '';
  }
}

/**
 * Get all tags from repository
 */
export function getAllTags(repoPath: string): string[] {
  try {
    const tags = execGit('tag -l', repoPath);
    return tags ? tags.split('\n').filter((tag) => tag.trim().length > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Get tag information from local repository
 */
export function getTagInfo(tagName: string, repoPath: string): ItemInfo {
  if (!tagExists(tagName, repoPath)) {
    return {
      exists: false,
      name: tagName,
      item_sha: '',
      item_type: ItemType.COMMIT,
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
    execGit(`verify-tag ${tagName}`, repoPath);
    verified = true;
  } catch {
    // Tag is not verified or verification failed
    verified = false;
  }

  return {
    exists: true,
    name: tagName,
    item_sha: tagSha,
    item_type: isAnnotated ? ItemType.TAG : ItemType.COMMIT,
    commit_sha: commitSha,
    details: tagMessage,
    verified,
    is_draft: false,
    is_prerelease: false,
  };
}

