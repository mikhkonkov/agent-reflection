import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { configSchema } from "./config-schema.js";
import { defaultConfig, DEFAULT_CONFIG_JSON } from "./defaults.js";
import { logger } from "../shared/logger.js";
/**
 * Load and validate config from a JSON file. On any error (missing file, invalid
 * JSON, schema violation) it returns the default config and emits only a local
 * diagnostic — configuration problems must never block telemetry.
 */
export function loadConfig(configPath) {
    if (!existsSync(configPath)) {
        return defaultConfig();
    }
    try {
        const raw = readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw);
        const result = configSchema.safeParse(parsed);
        if (!result.success) {
            logger.warn("Invalid config; falling back to defaults", {
                configPath,
                issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
            });
            return defaultConfig();
        }
        return result.data;
    }
    catch (error) {
        logger.warn("Failed to read config; falling back to defaults", {
            configPath,
            error: error instanceof Error ? error.message : String(error),
        });
        return defaultConfig();
    }
}
/** Write the default config to disk, creating parent directories as needed. */
export function writeDefaultConfig(configPath) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG_JSON, null, 2)}\n`, "utf8");
}
/** Persist an already-validated config object. */
export function saveConfig(configPath, config) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
/**
 * Apply a dotted-path assignment (e.g. "privacy.storeRawPayloads" = false) to a
 * config object, coercing common scalar string inputs, then re-validate.
 */
export function setConfigValue(config, dottedKey, rawValue) {
    const coerced = coerceScalar(rawValue);
    const clone = structuredClone(config);
    const segments = dottedKey.split(".");
    let cursor = clone;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i];
        const next = cursor[key];
        if (typeof next !== "object" || next === null) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = coerced;
    return configSchema.parse(clone);
}
function coerceScalar(value) {
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    if (value !== "" && !Number.isNaN(Number(value)))
        return Number(value);
    return value;
}
//# sourceMappingURL=config-service.js.map