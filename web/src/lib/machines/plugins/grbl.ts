/**
 * GRBL machine plugin.
 *
 * GRBL is a serial-based G-code controller for CNC routers, laser engravers,
 * and similar machines. The scan station connects via USB serial to the GRBL
 * controller, parses real-time status reports (`?` command → `<...>` response),
 * and relays normalized status.
 *
 * Status format: <Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>
 * GRBL docs: https://github.com/gnea/grbl/wiki/Grbl-v1.1-Interface
 */

import type {
  MachinePlugin,
  NormalizedMachineStatus,
  MachineState,
  BridgeConfigInput,
  ConnectionFieldDef,
} from "../types";

const GRBL_STATE_MAP: Record<string, MachineState> = {
  idle: "idle",
  run: "printing", // "printing" covers active job execution for CNC/laser too
  hold: "paused",
  "hold:0": "paused",
  "hold:1": "paused",
  jog: "busy",
  alarm: "error",
  door: "error",
  "door:0": "error",
  "door:1": "error",
  "door:2": "error",
  "door:3": "error",
  check: "busy",
  home: "busy",
  sleep: "idle",
};

function mapState(raw: string | undefined): MachineState {
  if (!raw) return "offline";
  const key = raw.toLowerCase();
  return GRBL_STATE_MAP[key] ?? (key.startsWith("alarm") ? "error" : "idle");
}

export const grblPlugin: MachinePlugin = {
  protocol: "grbl",
  displayName: "GRBL",
  description: "GRBL CNC/laser controllers via USB serial (CNC routers, laser engravers)",
  supportedMachineTypes: ["cnc", "laser"],

  connectionFields: [
    {
      key: "serialPort",
      label: "Serial Port",
      type: "text",
      required: true,
      placeholder: "/dev/ttyUSB0 or COM3",
      helpText: "USB serial port on the scan station connected to the GRBL controller",
    },
    {
      key: "baudRate",
      label: "Baud Rate",
      type: "number",
      required: false,
      placeholder: "115200",
      helpText: "Default 115200 for most GRBL boards",
    },
  ] satisfies ConnectionFieldDef[],

  validateConfig(config) {
    const errors: string[] = [];
    if (!config.serialPort || typeof config.serialPort !== "string") {
      errors.push("Serial port is required");
    }
    if (config.baudRate != null && typeof config.baudRate !== "number") {
      errors.push("Baud rate must be a number");
    }
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  },

  normalizeStatus(raw): NormalizedMachineStatus {
    // The scan station firmware parses GRBL status reports and sends JSON:
    // { state, mpos: {x,y,z}, wpos: {x,y,z}, feedRate, spindleSpeed,
    //   laserPower, buffer: {plannerAvail, rxAvail}, pins, overrides }
    const state = mapState(raw.state as string | undefined);

    const status: NormalizedMachineStatus = {
      state,
      protocol: "grbl",
      lastUpdated: new Date().toISOString(),
    };

    // Position (prefer work position, fall back to machine position)
    const wpos = raw.wpos as Record<string, number> | undefined;
    const mpos = raw.mpos as Record<string, number> | undefined;
    const pos = wpos ?? mpos;
    if (pos && pos.x != null) {
      status.position = { x: pos.x, y: pos.y ?? 0, z: pos.z ?? 0 };
    }

    // Feed rate
    if (typeof raw.feedRate === "number") {
      status.feedRate = raw.feedRate as number;
    }

    // Spindle RPM (CNC)
    if (typeof raw.spindleSpeed === "number" && (raw.spindleSpeed as number) > 0) {
      status.spindleRpm = raw.spindleSpeed as number;
    }

    // Laser power (laser engraver/cutter)
    if (typeof raw.laserPower === "number") {
      // GRBL sends 0-1000 (S-value), normalize to 0-100%
      const maxPower = (raw.maxSpindleSpeed as number) || 1000;
      status.laserPower = Math.round(((raw.laserPower as number) / maxPower) * 100);
    }

    // Job progress (if the scan station tracks file streaming)
    if (raw.jobProgress != null) {
      status.job = {
        name: raw.jobFile as string | undefined,
        progress: typeof raw.jobProgress === "number" ? Math.round(raw.jobProgress as number) : 0,
        elapsedTime: raw.jobElapsedTime as number | undefined,
        remainingTime: raw.jobRemainingTime as number | undefined,
      };
    }

    // Alarm/error
    if (state === "error") {
      status.error = {
        code: raw.alarmCode as number | undefined,
        message: raw.alarmMessage as string | undefined
          ?? (raw.alarmCode != null ? `GRBL Alarm ${raw.alarmCode}` : "Alarm state"),
      };
    }

    status.raw = raw;
    return status;
  },

  buildBridgeConfig(machine: BridgeConfigInput) {
    const cc = machine.connectionConfig ?? {};
    const serialPort = cc.serialPort as string | undefined;
    if (!serialPort) return null;

    return {
      protocol: "grbl",
      machineId: machine.machineId,
      serialPort,
      baudRate: (cc.baudRate as number) || 115200,
      // Scan station polls GRBL with `?` command at this interval
      pollIntervalMs: 500,
    };
  },
};
