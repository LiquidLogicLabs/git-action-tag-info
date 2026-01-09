/**
 * Logger utility with verbose/debug support
 * Provides consistent logging across the action
 */
export declare class Logger {
    readonly verbose: boolean;
    constructor(verbose?: boolean);
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
    /**
     * Log a debug message - uses core.info() when verbose is true so it always shows
     * Falls back to core.debug() when verbose is false (for when ACTIONS_STEP_DEBUG is set)
     */
    debug(message: string): void;
}
