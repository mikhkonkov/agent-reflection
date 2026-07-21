import { configSchema, type AuditorConfig } from "./config-schema.js";

/** The canonical default configuration, produced by parsing an empty object. */
export function defaultConfig(): AuditorConfig {
  return configSchema.parse({});
}

/** The default configuration serialized for writing config.json on init. */
export const DEFAULT_CONFIG_JSON = {
  enabled: true,
  privacy: {
    storeRawPayloads: false,
    storePromptText: false,
    storeToolOutput: false,
  },
  thresholds: {
    excessiveExplorationCalls: 15,
    explorationCallRatio: 0.7,
    repeatedFailureCount: 3,
    escalationMinTurns: 12,
    contextOutputBytes: 512000,
    cheapCandidateMinCalls: 5,
  },
  reports: {
    writeMarkdown: true,
    printSummaryAtSessionEnd: true,
  },
} as const;
