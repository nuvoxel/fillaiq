/**
 * Klipper machine plugin (via Moonraker API).
 *
 * Klipper printers expose status through Moonraker's REST/WebSocket API.
 * The scan station polls `GET /printer/objects/query` or subscribes via
 * WebSocket for real-time updates, then relays normalized status.
 *
 * Moonraker query objects: print_stats, heater_bed, extruder,
 * display_status, virtual_sdcard, toolhead, gcode_move.
 */

import type {
  MachinePlugin,
  NormalizedMachineStatus,
  MachineState,
  BridgeConfigInput,
  ConnectionFieldDef,
} from "../types";

const KLIPPER_STATE_MAP: Record<string, MachineState> = {
  standby: "idle",
  printing: "printing",
  paused: "paused",
  complete: "finishing",
  cancelled: "cancelled",
  error: "error",
};

function mapState(raw: string | undefined): MachineState {
  if (!raw) return "offline";
  return KLIPPER_STATE_MAP[raw.toLowerCase()] ?? "idle";
}

export const klipperPlugin: MachinePlugin = {
  protocol: "klipper",
  displayName: "Klipper (Moonraker)",
  description: "Klipper firmware via Moonraker API (Voron, Ender conversions, etc.)",
  supportedMachineTypes: ["fdm", "multi"],

  connectionFields: [
    {
      key: "moonrakerUrl",
      label: "Moonraker URL",
      type: "url",
      required: true,
      placeholder: "http://192.168.1.100:7125",
      helpText: "Moonraker API address (usually port 7125)",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: false,
      placeholder: "Optional — only if Moonraker requires auth",
      helpText: "Found in Moonraker config or Mainsail/Fluidd settings",
    },
  ] satisfies ConnectionFieldDef[],

  validateConfig(config) {
    const errors: string[] = [];
    const url = config.moonrakerUrl;
    if (!url || typeof url !== "string") {
      errors.push("Moonraker URL is required");
    } else {
      try {
        new URL(url as string);
      } catch {
        errors.push("Invalid Moonraker URL format");
      }
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  },

  normalizeStatus(raw): NormalizedMachineStatus {
    // Moonraker returns nested objects keyed by query object name
    const printStats = (raw.print_stats ?? raw.printStats ?? {}) as Record<string, unknown>;
    const extruder = (raw.extruder ?? {}) as Record<string, unknown>;
    const heaterBed = (raw.heater_bed ?? raw.heaterBed ?? {}) as Record<string, unknown>;
    const displayStatus = (raw.display_status ?? raw.displayStatus ?? {}) as Record<string, unknown>;
    const virtualSd = (raw.virtual_sdcard ?? raw.virtualSdcard ?? {}) as Record<string, unknown>;
    const toolhead = (raw.toolhead ?? {}) as Record<string, unknown>;

    const state = mapState(printStats.state as string | undefined);

    const status: NormalizedMachineStatus = {
      state,
      stateMessage: printStats.message as string | undefined,
      protocol: "klipper",
      lastUpdated: new Date().toISOString(),
    };

    // Temperatures
    status.temperatures = {};
    if (extruder.temperature != null) {
      status.temperatures.nozzle = {
        current: extruder.temperature as number,
        target: extruder.target as number | undefined,
      };
    }
    if (heaterBed.temperature != null) {
      status.temperatures.bed = {
        current: heaterBed.temperature as number,
        target: heaterBed.target as number | undefined,
      };
    }
    // Klipper supports arbitrary heaters — check for common extras
    const chamber = (raw["temperature_sensor chamber"] ?? raw.chamberSensor) as Record<string, unknown> | undefined;
    if (chamber?.temperature != null) {
      status.temperatures.chamber = { current: chamber.temperature as number };
    }

    // Print job
    if (state === "printing" || state === "paused" || state === "finishing") {
      const progress = typeof virtualSd.progress === "number"
        ? Math.round((virtualSd.progress as number) * 100)
        : (displayStatus.progress != null
            ? Math.round((displayStatus.progress as number) * 100)
            : 0);

      const totalDuration = printStats.total_duration as number | undefined;
      const printDuration = printStats.print_duration as number | undefined;

      status.job = {
        name: printStats.filename as string | undefined,
        progress,
        elapsedTime: printDuration ?? totalDuration,
        remainingTime: progress > 0 && printDuration
          ? Math.round((printDuration / progress) * (100 - progress))
          : undefined,
      };

      // Layer info from display_status (SET_PRINT_STATS_INFO in gcode)
      if (typeof printStats.info === "object" && printStats.info) {
        const info = printStats.info as Record<string, unknown>;
        status.job.currentLayer = info.current_layer as number | undefined;
        status.job.totalLayers = info.total_layer as number | undefined;
      }
    }

    // Toolhead position
    if (toolhead.position) {
      const pos = toolhead.position as number[];
      if (pos.length >= 3) {
        status.position = { x: pos[0], y: pos[1], z: pos[2] };
      }
    }

    // Error
    if (state === "error" && printStats.message) {
      status.error = { message: printStats.message as string };
    }

    status.raw = raw;
    return status;
  },

  buildBridgeConfig(machine: BridgeConfigInput) {
    const cc = machine.connectionConfig ?? {};
    const moonrakerUrl = cc.moonrakerUrl as string | undefined;
    if (!moonrakerUrl) return null;

    return {
      protocol: "klipper",
      machineId: machine.machineId,
      moonrakerUrl,
      apiKey: cc.apiKey ?? null,
      // Scan station polls these endpoints
      pollEndpoints: [
        "/printer/objects/query?print_stats&extruder&heater_bed&display_status&virtual_sdcard&toolhead",
      ],
      pollIntervalMs: 2000,
      // WebSocket for real-time (preferred if scan station supports it)
      wsUrl: moonrakerUrl.replace(/^http/, "ws") + "/websocket",
    };
  },
};
