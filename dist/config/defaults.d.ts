import { type AuditorConfig } from "./config-schema.js";
/** The canonical default configuration, produced by parsing an empty object. */
export declare function defaultConfig(): AuditorConfig;
/** The default configuration serialized for writing config.json on init. */
export declare const DEFAULT_CONFIG_JSON: {
    readonly enabled: true;
    readonly privacy: {
        readonly storeRawPayloads: false;
        readonly storePromptText: false;
        readonly storeToolOutput: false;
    };
    readonly thresholds: {
        readonly excessiveExplorationCalls: 15;
        readonly explorationCallRatio: 0.7;
        readonly repeatedFailureCount: 3;
        readonly escalationMinTurns: 12;
        readonly contextOutputBytes: 512000;
        readonly cheapCandidateMinCalls: 5;
    };
    readonly reports: {
        readonly writeMarkdown: true;
        readonly printSummaryAtSessionEnd: true;
    };
};
