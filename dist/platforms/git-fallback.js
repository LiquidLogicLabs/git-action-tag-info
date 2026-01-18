"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGitLsRemoteFallback = tryGitLsRemoteFallback;
const child_process_1 = require("child_process");
const types_1 = require("../types");
/**
 * Try to get tag information using git ls-remote as a fallback when API fails
 * This is platform-agnostic and works with any git repository
 *
 * @param tagName - The tag name to look up
 * @param repoUrl - The repository URL (will be normalized)
 * @param logger - Logger instance for debug output
 * @returns ItemInfo if tag found, null if not found or fallback failed
 */
function tryGitLsRemoteFallback(tagName, repoUrl, logger) {
    if (!repoUrl) {
        logger.debug('No repository URL available for git ls-remote fallback');
        return null;
    }
    try {
        logger.debug(`Attempting git ls-remote fallback for tag: ${tagName}`);
        // Normalize URL - remove .git suffix if present for ls-remote
        const remoteUrl = repoUrl.replace(/\.git$/, '');
        const output = (0, child_process_1.execSync)(`git ls-remote --tags ${remoteUrl} refs/tags/${tagName}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (output.length > 0) {
            // Tag exists on remote, parse the SHA
            // Output format: "SHA\trefs/tags/tagName"
            const sha = output.split(/\s+/)[0];
            if (sha && sha.length === 40) {
                // Valid SHA-1 format
                logger.debug(`Fallback successful: tag ${tagName} found via git ls-remote (SHA: ${sha})`);
                return {
                    exists: true,
                    name: tagName,
                    item_sha: sha,
                    item_type: types_1.ItemType.COMMIT,
                    commit_sha: sha,
                    details: '',
                    verified: false,
                    is_draft: false,
                    is_prerelease: false,
                };
            }
            else {
                logger.debug(`Fallback returned invalid SHA format: ${sha}`);
            }
        }
        else {
            logger.debug(`Fallback returned empty result for tag: ${tagName}`);
        }
    }
    catch (error) {
        // Fallback failed, log and return null
        if (error instanceof Error) {
            logger.debug(`git ls-remote fallback failed: ${error.message}`);
        }
        else {
            logger.debug(`git ls-remote fallback failed: ${String(error)}`);
        }
    }
    return null;
}
//# sourceMappingURL=git-fallback.js.map