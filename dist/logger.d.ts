/**
 * Logger utility with verbose/debug support
 * Provides consistent logging across the action
 */
export declare class Logger {
    readonly verbose: boolean;
    readonly debugMode: boolean;
    constructor(verbose?: boolean, debugMode?: boolean);
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
    /**
     * Log operational/verbose info - only shown when verbose is true
     * Use for: platform detected, tag found, input values resolved, git commands executed
     */
    verboseInfo(message: string): void;
    /**
     * Log a debug message - uses core.info() when debugMode is true so it always shows
     * Falls back to core.debug() when debugMode is false (for when ACTIONS_STEP_DEBUG is set)
     * Use for: HTTP requests/responses, headers, response bodies, raw data
     */
    debug(message: string): void;
    isVerbose(): boolean;
    isDebug(): boolean;
}
