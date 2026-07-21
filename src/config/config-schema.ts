import { z } from "zod";
import type { ToolClassification } from "../domain/event.js";

const toolClassificationValues: [ToolClassification, ...ToolClassification[]] = [
  "discovery",
  "modification",
  "execution",
  "external_research",
  "delegation",
  "other",
];

export const privacyConfigSchema = z
  .object({
    storeRawPayloads: z.boolean().default(false),
    storePromptText: z.boolean().default(false),
    storeToolOutput: z.boolean().default(false),
  })
  .strict();

export const thresholdsConfigSchema = z
  .object({
    excessiveExplorationCalls: z.number().int().positive().default(15),
    explorationCallRatio: z.number().min(0).max(1).default(0.7),
    repeatedFailureCount: z.number().int().positive().default(3),
    escalationMinTurns: z.number().int().positive().default(12),
    contextOutputBytes: z.number().int().positive().default(512000),
    cheapCandidateMinCalls: z.number().int().positive().default(5),
  })
  .strict();

export const reportsConfigSchema = z
  .object({
    writeMarkdown: z.boolean().default(true),
    printSummaryAtSessionEnd: z.boolean().default(true),
  })
  .strict();

export const statuslineConfigSchema = z
  .object({
    /**
     * Offer to wire up the statusline context meter once, at SessionStart, when
     * no statusLine is configured. A plugin cannot register one itself, so the
     * alternative is the user never learning the meter exists. Set false to
     * never mention it.
     */
    promptOnSessionStart: z.boolean().default(true),
  })
  .strict();

export const configSchema = z
  .object({
    enabled: z.boolean().default(true),
    privacy: privacyConfigSchema.default({}),
    thresholds: thresholdsConfigSchema.default({}),
    reports: reportsConfigSchema.default({}),
    statusline: statuslineConfigSchema.default({}),
    /** Optional per-repo overrides of the tool classification map. */
    toolClassifications: z.record(z.string(), z.enum(toolClassificationValues)).default({}),
  })
  .strict();

export type PrivacyConfig = z.infer<typeof privacyConfigSchema>;
export type ThresholdsConfig = z.infer<typeof thresholdsConfigSchema>;
export type ReportsConfig = z.infer<typeof reportsConfigSchema>;
export type StatuslineConfig = z.infer<typeof statuslineConfigSchema>;
export type AuditorConfig = z.infer<typeof configSchema>;
