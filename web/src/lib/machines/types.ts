/**
 * Machine plugin architecture — shared types.
 *
 * Every machine protocol (Bambu, Klipper, OctoPrint, PrusaLink, GRBL)
 * implements the MachinePlugin interface to normalize raw status data
 * into a common shape the UI and server can consume uniformly.
 */

// ── Machine states (protocol-agnostic) ──────────────────────────────────────

export type MachineState =
  | "idle"
  | "printing"
  | "paused"
  | "error"
  | "offline"
  | "busy"
  | "finishing"
  | "cancelled";

// ── Normalized status (what the UI consumes) ────────────────────────────────

export type TemperatureReading = {
  current: number;
  target?: number;
};

export type MaterialSlotStatus = {
  index: number;
  material?: string;
  color?: number; // RGBA packed integer
  remaining?: number; // 0-100
  humidity?: number;
};

export type PrintJobStatus = {
  name?: string;
  progress: number; // 0-100
  currentLayer?: number;
  totalLayers?: number;
  elapsedTime?: number; // seconds
  remainingTime?: number; // seconds
  filePath?: string;
};

export type NormalizedMachineStatus = {
  state: MachineState;
  stateMessage?: string;
  protocol: string;
  lastUpdated: string; // ISO 8601

  job?: PrintJobStatus;

  temperatures?: {
    nozzle?: TemperatureReading;
    bed?: TemperatureReading;
    chamber?: TemperatureReading;
    [key: string]: TemperatureReading | undefined;
  };

  materialSlots?: MaterialSlotStatus[];

  // CNC/laser-specific
  spindleRpm?: number;
  laserPower?: number; // 0-100%
  feedRate?: number; // mm/min
  position?: { x: number; y: number; z: number };

  wifiSignal?: number; // dBm
  error?: { code?: number; message?: string };

  // Protocol-specific raw payload (for advanced UI features)
  raw?: Record<string, unknown>;
};

// ── Connection config (protocol-specific, stored in machines.connectionConfig) ─

export type ConnectionFieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "url";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
};

// ── Machine plugin interface ────────────────────────────────────────────────

export interface MachinePlugin {
  /** Protocol identifier — matches the machine_protocol enum value */
  protocol: string;

  /** Human-readable name for UI display */
  displayName: string;

  /** Short description of the protocol */
  description: string;

  /** Which machine types this protocol supports */
  supportedMachineTypes: Array<"fdm" | "cnc" | "laser" | "resin" | "multi">;

  /** Connection fields the UI should render for configuration */
  connectionFields: ConnectionFieldDef[];

  /** Validate a connection config object */
  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors?: string[];
  };

  /**
   * Normalize a raw status payload (from MQTT relay or API poll)
   * into the common NormalizedMachineStatus shape.
   */
  normalizeStatus(raw: Record<string, unknown>): NormalizedMachineStatus;

  /**
   * Build the config payload to push to the scan station so it knows
   * how to connect to this machine on the local network.
   * Returns null if bridging is not supported for this protocol.
   */
  buildBridgeConfig(
    machine: BridgeConfigInput
  ): Record<string, unknown> | null;
}

/** Minimal machine info needed to build a bridge config */
export type BridgeConfigInput = {
  machineId: string;
  protocol: string;
  ipAddress?: string | null;
  connectionConfig?: Record<string, unknown> | null;
};
