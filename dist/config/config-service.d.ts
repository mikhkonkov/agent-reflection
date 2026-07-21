import { type AuditorConfig } from "./config-schema.js";
/**
 * Load and validate config from a JSON file. On any error (missing file, invalid
 * JSON, schema violation) it returns the default config and emits only a local
 * diagnostic — configuration problems must never block telemetry.
 */
export declare function loadConfig(configPath: string): AuditorConfig;
/** Write the default config to disk, creating parent directories as needed. */
export declare function writeDefaultConfig(configPath: string): void;
/** Persist an already-validated config object. */
export declare function saveConfig(configPath: string, config: AuditorConfig): void;
/**
 * Apply a dotted-path assignment (e.g. "privacy.storeRawPayloads" = false) to a
 * config object, coercing common scalar string inputs, then re-validate.
 */
export declare function setConfigValue(config: AuditorConfig, dottedKey: string, rawValue: string): AuditorConfig;
