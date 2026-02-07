"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInputs = getInputs;
exports.resolveToken = resolveToken;
const core = __importStar(require("@actions/core"));
const types_1 = require("./types");
const format_parser_1 = require("./format-parser");
/**
 * Parse boolean input with default value
 */
function getBooleanInput(name, defaultValue = false) {
    const value = core.getInput(name);
    if (value === '') {
        return defaultValue;
    }
    return value.toLowerCase() === 'true';
}
/**
 * Get optional string input
 */
function getOptionalInput(name) {
    const value = core.getInput(name);
    return value === '' ? undefined : value;
}
/**
 * Get and validate action inputs
 */
function getInputs() {
    const tagName = core.getInput('tagName', { required: true });
    if (!tagName || tagName.trim() === '') {
        throw new Error('tagName is required and cannot be empty');
    }
    const tagTypeInput = core.getInput('tagType') || 'tags';
    if (tagTypeInput !== 'tags' && tagTypeInput !== 'release') {
        throw new Error(`Invalid tagType: ${tagTypeInput}. Must be 'tags' or 'release'`);
    }
    const tagType = tagTypeInput;
    const repository = getOptionalInput('repository');
    const platform = getOptionalInput('platform') || getOptionalInput('repoType');
    const owner = getOptionalInput('owner');
    const repo = getOptionalInput('repo');
    const baseUrl = getOptionalInput('baseUrl');
    const token = getOptionalInput('token');
    const ignoreCertErrors = getBooleanInput('skipCertificateCheck', false);
    const tagFormatInput = getOptionalInput('tagFormat');
    const tagFormat = (0, format_parser_1.parseTagFormat)(tagFormatInput);
    const verboseInput = getBooleanInput('verbose', false);
    const envStepDebug = (process.env.ACTIONS_STEP_DEBUG || '').toLowerCase();
    const stepDebugEnabled = core.isDebug() || envStepDebug === 'true' || envStepDebug === '1';
    const verbose = verboseInput || stepDebugEnabled;
    // Validate base URL format if provided
    if (baseUrl) {
        try {
            new URL(baseUrl);
        }
        catch {
            throw new Error(`Invalid baseUrl format: ${baseUrl}`);
        }
    }
    return {
        tagName: tagName.trim(),
        tagType,
        repository: repository?.trim(),
        platform: platform?.trim(),
        owner: owner?.trim(),
        repo: repo?.trim(),
        baseUrl: baseUrl?.trim(),
        token: token?.trim() || undefined,
        ignoreCertErrors,
        tagFormat,
        verbose,
    };
}
/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
function resolveToken(token, platform) {
    // If token is explicitly provided, use it
    if (token) {
        return token;
    }
    // Otherwise, try platform-specific environment variables
    switch (platform) {
        case types_1.Platform.GITHUB:
            return process.env.GITHUB_TOKEN;
        case types_1.Platform.GITEA:
            return process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN; // Gitea Actions also provides GITHUB_TOKEN
        case types_1.Platform.BITBUCKET:
            return process.env.BITBUCKET_TOKEN;
        case 'auto':
        default:
            // For auto or unknown, try common token environment variables
            return (process.env.GITHUB_TOKEN ||
                process.env.GITEA_TOKEN ||
                process.env.BITBUCKET_TOKEN);
    }
}
//# sourceMappingURL=config.js.map