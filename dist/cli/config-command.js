import { openRepo } from "./context.js";
import { saveConfig, setConfigValue } from "../config/config-service.js";
export function registerConfigCommand(program) {
    const configCmd = program.command("config").description("View or edit Agent Reflection configuration");
    configCmd
        .command("show")
        .description("Print the current configuration as JSON")
        .action(() => {
        runConfigShow();
    });
    configCmd
        .command("set")
        .argument("<key>", "dotted config key, e.g. privacy.storeRawPayloads")
        .argument("<value>", "value to assign")
        .description("Set a configuration value")
        .action((key, value) => {
        runConfigSet(key, value);
    });
}
function runConfigShow() {
    const { config, db } = openRepo();
    db.close();
    console.log(JSON.stringify(config, null, 2));
}
function runConfigSet(key, value) {
    const { paths, config, db } = openRepo();
    db.close();
    try {
        const updated = setConfigValue(config, key, value);
        saveConfig(paths.configPath, updated);
        console.log(`Set ${key} = ${value}`);
    }
    catch (error) {
        console.error(`Invalid config value: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=config-command.js.map