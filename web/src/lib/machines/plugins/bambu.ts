/**
 * Bambu Lab machine plugin.
 *
 * Bambu printers expose a local MQTT broker on port 8883 (TLS).
 * The scan station connects as a bridge, subscribing to
 * `device/{serial}/report` and relaying normalized status to the server.
 *
 * Raw status shape comes from Bambu's MQTT report messages — fields like
 * gcode_state, nozzle_temper, bed_temper, mc_percent, etc.
 */

import type {
  MachinePlugin,
  NormalizedMachineStatus,
  MachineState,
  MaterialSlotStatus,
  BridgeConfigInput,
  ConnectionFieldDef,
} from "../types";

const BAMBU_GCODE_STATE_MAP: Record<string, MachineState> = {
  IDLE: "idle",
  RUNNING: "printing",
  PAUSE: "paused",
  FINISH: "finishing",
  FAILED: "error",
  PREPARE: "busy",
  SLICING: "busy",
  UNKNOWN: "idle",
};

function mapState(raw: string | undefined): MachineState {
  if (!raw) return "offline";
  return BAMBU_GCODE_STATE_MAP[raw.toUpperCase()] ?? "idle";
}

function parseBambuTrays(raw: Record<string, unknown>): MaterialSlotStatus[] {
  const trays = raw.trays as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(trays)) return [];

  return trays.map((tray, i) => ({
    index: i,
    material: (tray.type as string) ?? undefined,
    color: typeof tray.color === "number" ? tray.color : undefined,
    remaining: typeof tray.remain === "number" ? tray.remain : undefined,
    humidity: typeof tray.humidity === "number" && tray.humidity >= 0
      ? tray.humidity
      : undefined,
  }));
}

export const bambuPlugin: MachinePlugin = {
  protocol: "bambu",
  displayName: "Bambu Lab",
  description: "Bambu Lab printers via local MQTT (X1C, P1S, A1, etc.)",
  supportedMachineTypes: ["fdm", "multi"],

  connectionFields: [
    {
      key: "accessCode",
      label: "LAN Access Code",
      type: "password",
      required: true,
      placeholder: "8-digit code from printer settings",
      helpText: "Found in printer LCD: Settings > General > LAN Only Mode",
    },
    {
      key: "serialNumber",
      label: "Serial Number",
      type: "text",
      required: true,
      placeholder: "e.g. 01P00A000000000",
      helpText: "Printed on the back of the printer or in Bambu Handy",
    },
  ] satisfies ConnectionFieldDef[],

  validateConfig(config) {
    const errors: string[] = [];
    if (!config.accessCode || typeof config.accessCode !== "string") {
      errors.push("LAN Access Code is required");
    } else if ((config.accessCode as string).length < 6) {
      errors.push("Access code should be at least 6 characters");
    }
    if (!config.serialNumber || typeof config.serialNumber !== "string") {
      errors.push("Serial number is required");
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  },

  normalizeStatus(raw): NormalizedMachineStatus {
    const state = mapState(raw.gcodeState as string | undefined);

    const status: NormalizedMachineStatus = {
      state,
      protocol: "bambu",
      lastUpdated: new Date().toISOString(),
    };

    // Temperatures
    const nozzleTemp = raw.nozzleTemp as number | undefined;
    const nozzleTarget = raw.nozzleTarget as number | undefined;
    const bedTemp = raw.bedTemp as number | undefined;
    const bedTarget = raw.bedTarget as number | undefined;
    const chamberTemp = raw.chamberTemp as number | undefined;

    if (nozzleTemp != null || bedTemp != null) {
      status.temperatures = {};
      if (nozzleTemp != null) {
        status.temperatures.nozzle = { current: nozzleTemp, target: nozzleTarget };
      }
      if (bedTemp != null) {
        status.temperatures.bed = { current: bedTemp, target: bedTarget };
      }
      if (chamberTemp != null) {
        status.temperatures.chamber = { current: chamberTemp };
      }
    }

    // Print job
    if (state === "printing" || state === "paused" || state === "finishing") {
      status.job = {
        name: raw.subtaskName as string | undefined,
        progress: (raw.printPercent as number) ?? 0,
        currentLayer: raw.currentLayer as number | undefined,
        totalLayers: raw.totalLayers as number | undefined,
        remainingTime: raw.remainingTime != null
          ? (raw.remainingTime as number) * 60 // Bambu sends minutes
          : undefined,
        filePath: raw.gcodeFile as string | undefined,
      };
    }

    // Material slots (AMS trays)
    const slots = parseBambuTrays(raw);
    if (slots.length > 0) {
      status.materialSlots = slots;
    }

    // WiFi
    if (typeof raw.wifiSignal === "number" && raw.wifiSignal !== 0) {
      status.wifiSignal = raw.wifiSignal as number;
    }

    // Error
    const printError = raw.printError as number | undefined;
    if (printError && printError > 0) {
      status.error = { code: printError };
    }

    status.raw = raw;
    return status;
  },

  buildBridgeConfig(machine: BridgeConfigInput) {
    const cc = machine.connectionConfig ?? {};
    if (!machine.ipAddress || !cc.accessCode || !cc.serialNumber) return null;

    return {
      protocol: "bambu",
      machineId: machine.machineId,
      ip: machine.ipAddress,
      port: 8883,
      accessCode: cc.accessCode,
      serialNumber: cc.serialNumber,
      // Bambu MQTT topic for status reports
      subscribeTopic: `device/${cc.serialNumber}/report`,
    };
  },
};
