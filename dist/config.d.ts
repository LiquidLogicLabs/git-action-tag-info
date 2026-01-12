import { Platform } from './types';
/**
 * Action inputs interface
 */
export interface ActionInputs {
    tagName: string;
    tagType: 'tags' | 'release';
    repository?: string;
    platform?: string;
    owner?: string;
    repo?: string;
    baseUrl?: string;
    token?: string;
    ignoreCertErrors: boolean;
    tagFormat?: string[];
    verbose: boolean;
}
/**
 * Get and validate action inputs
 */
export declare function getInputs(): ActionInputs;
/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
export declare function resolveToken(token: string | undefined, platform: Platform | 'auto'): string | undefined;
