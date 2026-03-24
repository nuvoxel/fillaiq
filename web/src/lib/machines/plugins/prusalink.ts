/**
 * PrusaLink / PrusaConnect machine plugin.
 *
 * PrusaLink runs on Prusa printers (MK4, XL, Mini, CORE One) and exposes
 * a local REST API. The scan station polls /api/v1/status and /api/v1/job.
 *
 * Docs: https://github.com/prusa3d/Prusa-Link-Web
 */

import type {
  MachinePlugin,
  NormalizedMachineStatus,
  MachineState,
  BridgeConfigInput,
  ConnectionFieldDef,
} from "../types";

const PRUSALINK_STATE_MAP: Record<string, MachineState> = {
  idle: "idle",
  busy: "busy",
  printing: "printing",
  paused: "paused",
  finished: "finishing",
  stopped: "cancelled",
  error: "error",
  attention: "error",
  ready: "idle",
};

function mapState(raw: string | undefined): MachineState {
  if (!raw) return "offline";
  return PRUSALINK_STATE_MAP[raw.toLowerCase()] ?? "idle";
}

export const prusalinkPlugin: MachinePlugin = {
  protocol: "prusalink",
  displayName: "PrusaLink",
  description: "Prusa printers via PrusaLink local API (MK4, XL, Mini, CORE One)",
  supportedMachineTypes: ["fdm", "multi"],

  connectionFields: [
    {
      key: "prusalinkUrl",
      label: "PrusaLink URL",
      type: "url",
      required: true,
      placeholder: "http://192.168.1.100",
      helpText: "PrusaLink web interface address (usually port 80)",
    },
    {
      key: "apiKey",
      label: "API Key (Digest password)",
      type: "password",
      required: true,
      placeholder: "PrusaLink API key or maker password",
      helpText: "Found in printer LCD: Settings > Network > PrusaLink",
    },
    {
      key: "username",
      label: "Username",
      type: "text",
      required: false,
      placeholder: "maker",
      helpText: "Default is 'maker' for Digest auth",
    },
  ] satisfies ConnectionFieldDef[],

  validateConfig(config) {
    const errors: string[] = [];
    const url = config.prusalinkUrl;
    if (!url || typeof url !== "string") {
      errors.push("PrusaLink URL is required");
    } else {
      try {
        new URL(url as string);
      } catch {
        errors.push("Invalid PrusaLink URL format");
      }
    }
    if (!config.apiKey || typeof config.apiKey !== "string") {
      errors.push("API Key is required");
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  },

  normalizeStatus(raw): NormalizedMachineStatus {
    // PrusaLink v1 status response
    const printer = (raw.printer ?? raw) as Record<string, unknown>;
    const job = (raw.job ?? {}) as Record<string, unknown>;

    const state = mapState(printer.state as string | undefined);

    const status: NormalizedMachineStatus = {
      state,
      protocol: "prusalink",
      lastUpdated: new Date().toISOString(),
    };

    // Temperatures
    const nozzleTemp = printer.temp_nozzle ?? printer.nozzle_temp;
    const bedTemp = printer.temp_bed ?? printer.bed_temp;
    const targetNozzle = printer.target_nozzle ?? printer.nozzle_target;
    const targetBed = printer.target_bed ?? printer.bed_target;

    if (nozzleTemp != null || bedTemp != null) {
      status.temperatures = {};
      if (nozzleTemp != null) {
        status.temperatures.nozzle = {
          current: nozzleTemp as number,
          target: targetNozzle as number | undefined,
        };
      }
      if (bedTemp != null) {
        status.temperatures.bed = {
          current: bedTemp as number,
          target: targetBed as number | undefined,
        };
      }
    }

    // Print job
    if (state === "printing" || state === "paused" || state === "finishing") {
      const pct = (job.progress ?? printer.progress) as number | undefined;
      const timeRemaining = (job.time_remaining ?? printer.time_remaining) as number | undefined;
      const timePrinting = (job.time_printing ?? printer.time_printing) as number | undefined;

      const jobFile = job.file as Record<string, unknown> | undefined;

      status.job = {
        name: (jobFile?.display_name ?? jobFile?.name ?? job.name) as string | undefined,
        progress: typeof pct === "number" ? Math.round(pct) : 0,
        elapsedTime: timePrinting,
        remainingTime: timeRemaining,
        filePath: (jobFile?.path ?? job.path) as string | undefined,
      };
    }

    // PrusaLink XL / MK4 with MMU
    const slots = raw.slots as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(slots)) {
      status.materialSlots = slots.map((slot, i) => ({
        index: i,
        material: slot.material as string | undefined,
        color: slot.color as number | undefined,
        remaining: slot.remaining as number | undefined,
      }));
    }

    // Error
    if (state === "error") {
      status.error = {
        code: printer.error_code as number | undefined,
        message: printer.error_message as string | undefined,
      };
    }

    // Position (PrusaLink v1 includes axis info)
    const axis = printer.axis as Record<string, number> | undefined;
    if (axis && axis.x != null) {
      status.position = { x: axis.x, y: axis.y ?? 0, z: axis.z ?? 0 };
    }

    status.raw = raw;
    return status;
  },

  buildBridgeConfig(machine: BridgeConfigInput) {
    const cc = machine.connectionConfig ?? {};
    const prusalinkUrl = cc.prusalinkUrl as string | undefined;
    const apiKey = cc.apiKey as string | undefined;
    if (!prusalinkUrl || !apiKey) return null;

    return {
      protocol: "prusalink",
      machineId: machine.machineId,
      baseUrl: prusalinkUrl,
      username: (cc.username as string) || "maker",
      apiKey,
      // PrusaLink uses Digest auth — scan station must implement
      authType: "digest",
      pollEndpoints: ["/api/v1/status"],
      pollIntervalMs: 3000,
    };
  },
};
