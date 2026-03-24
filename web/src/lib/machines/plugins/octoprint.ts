/**
 * OctoPrint machine plugin.
 *
 * OctoPrint exposes a REST API at /api/ with API key auth.
 * The scan station polls GET /api/printer and GET /api/job
 * for status, then relays normalized data.
 *
 * Docs: https://docs.octoprint.org/en/master/api/
 */

import type {
  MachinePlugin,
  NormalizedMachineStatus,
  MachineState,
  BridgeConfigInput,
  ConnectionFieldDef,
} from "../types";

const OCTOPRINT_STATE_MAP: Record<string, MachineState> = {
  operational: "idle",
  printing: "printing",
  pausing: "paused",
  paused: "paused",
  cancelling: "cancelled",
  error: "error",
  "offline after error": "error",
  offline: "offline",
  "open_serial": "busy",
  "detect_serial": "busy",
  connecting: "busy",
  closedorerror: "offline",
};

function mapState(flags: Record<string, unknown> | undefined, stateText: string | undefined): MachineState {
  if (!flags && !stateText) return "offline";

  // Flags take priority — they're booleans
  if (flags) {
    if (flags.error) return "error";
    if (flags.printing) return "printing";
    if (flags.pausing || flags.paused) return "paused";
    if (flags.cancelling) return "cancelled";
    if (flags.finishing) return "finishing";
    if (flags.operational || flags.ready) return "idle";
    if (flags.closedOrError) return "offline";
  }

  // Fall back to state text
  if (stateText) {
    const key = stateText.toLowerCase().replace(/\s+/g, " ").trim();
    return OCTOPRINT_STATE_MAP[key] ?? "idle";
  }

  return "idle";
}

export const octoprintPlugin: MachinePlugin = {
  protocol: "octoprint",
  displayName: "OctoPrint",
  description: "OctoPrint server REST API (Raspberry Pi, OctoPi, etc.)",
  supportedMachineTypes: ["fdm"],

  connectionFields: [
    {
      key: "octoprintUrl",
      label: "OctoPrint URL",
      type: "url",
      required: true,
      placeholder: "http://192.168.1.100:5000",
      helpText: "OctoPrint web interface address",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      placeholder: "OctoPrint API key",
      helpText: "Found in OctoPrint Settings > API > Global API Key",
    },
  ] satisfies ConnectionFieldDef[],

  validateConfig(config) {
    const errors: string[] = [];
    const url = config.octoprintUrl;
    if (!url || typeof url !== "string") {
      errors.push("OctoPrint URL is required");
    } else {
      try {
        new URL(url as string);
      } catch {
        errors.push("Invalid OctoPrint URL format");
      }
    }
    if (!config.apiKey || typeof config.apiKey !== "string") {
      errors.push("API Key is required");
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  },

  normalizeStatus(raw): NormalizedMachineStatus {
    // OctoPrint sends two merged payloads: printer state + job info
    const printerState = (raw.state ?? {}) as Record<string, unknown>;
    const flags = printerState.flags as Record<string, unknown> | undefined;
    const stateText = printerState.text as string | undefined;
    const temps = (raw.temperature ?? {}) as Record<string, Record<string, unknown>>;
    const job = (raw.job ?? {}) as Record<string, unknown>;
    const progress = (raw.progress ?? {}) as Record<string, unknown>;

    const state = mapState(flags, stateText);

    const status: NormalizedMachineStatus = {
      state,
      stateMessage: stateText,
      protocol: "octoprint",
      lastUpdated: new Date().toISOString(),
    };

    // Temperatures — OctoPrint uses tool0, tool1, bed, chamber keys
    status.temperatures = {};
    if (temps.tool0) {
      status.temperatures.nozzle = {
        current: (temps.tool0.actual as number) ?? 0,
        target: (temps.tool0.target as number) ?? undefined,
      };
    }
    if (temps.bed) {
      status.temperatures.bed = {
        current: (temps.bed.actual as number) ?? 0,
        target: (temps.bed.target as number) ?? undefined,
      };
    }
    if (temps.chamber) {
      status.temperatures.chamber = {
        current: (temps.chamber.actual as number) ?? 0,
      };
    }
    // Additional extruders
    for (let i = 1; i <= 7; i++) {
      const toolKey = `tool${i}`;
      if (temps[toolKey]) {
        status.temperatures[`nozzle${i}`] = {
          current: (temps[toolKey].actual as number) ?? 0,
          target: (temps[toolKey].target as number) ?? undefined,
        };
      }
    }

    // Print job
    if (state === "printing" || state === "paused" || state === "finishing") {
      const jobFile = job.file as Record<string, unknown> | undefined;
      const pct = progress.completion as number | undefined;

      status.job = {
        name: (jobFile?.display ?? jobFile?.name) as string | undefined,
        progress: typeof pct === "number" ? Math.round(pct) : 0,
        elapsedTime: progress.printTime as number | undefined,
        remainingTime: progress.printTimeLeft as number | undefined,
        filePath: jobFile?.path as string | undefined,
      };
    }

    // Error
    if (state === "error" && stateText) {
      status.error = { message: stateText };
    }

    status.raw = raw;
    return status;
  },

  buildBridgeConfig(machine: BridgeConfigInput) {
    const cc = machine.connectionConfig ?? {};
    const octoprintUrl = cc.octoprintUrl as string | undefined;
    const apiKey = cc.apiKey as string | undefined;
    if (!octoprintUrl || !apiKey) return null;

    return {
      protocol: "octoprint",
      machineId: machine.machineId,
      baseUrl: octoprintUrl,
      apiKey,
      pollEndpoints: ["/api/printer", "/api/job"],
      pollIntervalMs: 3000,
    };
  },
};
