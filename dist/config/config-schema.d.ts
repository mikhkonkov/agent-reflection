import { z } from "zod";
import type { ToolClassification } from "../domain/event.js";
export declare const privacyConfigSchema: z.ZodObject<{
    storeRawPayloads: z.ZodDefault<z.ZodBoolean>;
    storePromptText: z.ZodDefault<z.ZodBoolean>;
    storeToolOutput: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    storeRawPayloads: boolean;
    storePromptText: boolean;
    storeToolOutput: boolean;
}, {
    storeRawPayloads?: boolean | undefined;
    storePromptText?: boolean | undefined;
    storeToolOutput?: boolean | undefined;
}>;
export declare const thresholdsConfigSchema: z.ZodObject<{
    excessiveExplorationCalls: z.ZodDefault<z.ZodNumber>;
    explorationCallRatio: z.ZodDefault<z.ZodNumber>;
    repeatedFailureCount: z.ZodDefault<z.ZodNumber>;
    escalationMinTurns: z.ZodDefault<z.ZodNumber>;
    contextOutputBytes: z.ZodDefault<z.ZodNumber>;
    cheapCandidateMinCalls: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    excessiveExplorationCalls: number;
    explorationCallRatio: number;
    repeatedFailureCount: number;
    escalationMinTurns: number;
    contextOutputBytes: number;
    cheapCandidateMinCalls: number;
}, {
    excessiveExplorationCalls?: number | undefined;
    explorationCallRatio?: number | undefined;
    repeatedFailureCount?: number | undefined;
    escalationMinTurns?: number | undefined;
    contextOutputBytes?: number | undefined;
    cheapCandidateMinCalls?: number | undefined;
}>;
export declare const reportsConfigSchema: z.ZodObject<{
    writeMarkdown: z.ZodDefault<z.ZodBoolean>;
    printSummaryAtSessionEnd: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    writeMarkdown: boolean;
    printSummaryAtSessionEnd: boolean;
}, {
    writeMarkdown?: boolean | undefined;
    printSummaryAtSessionEnd?: boolean | undefined;
}>;
export declare const statuslineConfigSchema: z.ZodObject<{
    /**
     * Offer to wire up the statusline context meter once, at SessionStart, when
     * no statusLine is configured. A plugin cannot register one itself, so the
     * alternative is the user never learning the meter exists. Set false to
     * never mention it.
     */
    promptOnSessionStart: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    promptOnSessionStart: boolean;
}, {
    promptOnSessionStart?: boolean | undefined;
}>;
export declare const configSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    privacy: z.ZodDefault<z.ZodObject<{
        storeRawPayloads: z.ZodDefault<z.ZodBoolean>;
        storePromptText: z.ZodDefault<z.ZodBoolean>;
        storeToolOutput: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        storeRawPayloads: boolean;
        storePromptText: boolean;
        storeToolOutput: boolean;
    }, {
        storeRawPayloads?: boolean | undefined;
        storePromptText?: boolean | undefined;
        storeToolOutput?: boolean | undefined;
    }>>;
    thresholds: z.ZodDefault<z.ZodObject<{
        excessiveExplorationCalls: z.ZodDefault<z.ZodNumber>;
        explorationCallRatio: z.ZodDefault<z.ZodNumber>;
        repeatedFailureCount: z.ZodDefault<z.ZodNumber>;
        escalationMinTurns: z.ZodDefault<z.ZodNumber>;
        contextOutputBytes: z.ZodDefault<z.ZodNumber>;
        cheapCandidateMinCalls: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        excessiveExplorationCalls: number;
        explorationCallRatio: number;
        repeatedFailureCount: number;
        escalationMinTurns: number;
        contextOutputBytes: number;
        cheapCandidateMinCalls: number;
    }, {
        excessiveExplorationCalls?: number | undefined;
        explorationCallRatio?: number | undefined;
        repeatedFailureCount?: number | undefined;
        escalationMinTurns?: number | undefined;
        contextOutputBytes?: number | undefined;
        cheapCandidateMinCalls?: number | undefined;
    }>>;
    reports: z.ZodDefault<z.ZodObject<{
        writeMarkdown: z.ZodDefault<z.ZodBoolean>;
        printSummaryAtSessionEnd: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        writeMarkdown: boolean;
        printSummaryAtSessionEnd: boolean;
    }, {
        writeMarkdown?: boolean | undefined;
        printSummaryAtSessionEnd?: boolean | undefined;
    }>>;
    statusline: z.ZodDefault<z.ZodObject<{
        /**
         * Offer to wire up the statusline context meter once, at SessionStart, when
         * no statusLine is configured. A plugin cannot register one itself, so the
         * alternative is the user never learning the meter exists. Set false to
         * never mention it.
         */
        promptOnSessionStart: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        promptOnSessionStart: boolean;
    }, {
        promptOnSessionStart?: boolean | undefined;
    }>>;
    /** Optional per-repo overrides of the tool classification map. */
    toolClassifications: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodEnum<[ToolClassification, ...ToolClassification[]]>>>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    privacy: {
        storeRawPayloads: boolean;
        storePromptText: boolean;
        storeToolOutput: boolean;
    };
    thresholds: {
        excessiveExplorationCalls: number;
        explorationCallRatio: number;
        repeatedFailureCount: number;
        escalationMinTurns: number;
        contextOutputBytes: number;
        cheapCandidateMinCalls: number;
    };
    reports: {
        writeMarkdown: boolean;
        printSummaryAtSessionEnd: boolean;
    };
    statusline: {
        promptOnSessionStart: boolean;
    };
    toolClassifications: Record<string, ToolClassification>;
}, {
    enabled?: boolean | undefined;
    privacy?: {
        storeRawPayloads?: boolean | undefined;
        storePromptText?: boolean | undefined;
        storeToolOutput?: boolean | undefined;
    } | undefined;
    thresholds?: {
        excessiveExplorationCalls?: number | undefined;
        explorationCallRatio?: number | undefined;
        repeatedFailureCount?: number | undefined;
        escalationMinTurns?: number | undefined;
        contextOutputBytes?: number | undefined;
        cheapCandidateMinCalls?: number | undefined;
    } | undefined;
    reports?: {
        writeMarkdown?: boolean | undefined;
        printSummaryAtSessionEnd?: boolean | undefined;
    } | undefined;
    statusline?: {
        promptOnSessionStart?: boolean | undefined;
    } | undefined;
    toolClassifications?: Record<string, ToolClassification> | undefined;
}>;
export type PrivacyConfig = z.infer<typeof privacyConfigSchema>;
export type ThresholdsConfig = z.infer<typeof thresholdsConfigSchema>;
export type ReportsConfig = z.infer<typeof reportsConfigSchema>;
export type StatuslineConfig = z.infer<typeof statuslineConfigSchema>;
export type AuditorConfig = z.infer<typeof configSchema>;
