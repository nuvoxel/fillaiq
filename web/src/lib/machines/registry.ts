/**
 * Machine plugin registry.
 *
 * Central lookup for protocol plugins. Import and register each plugin here.
 * The rest of the codebase uses getPlugin(protocol) to access normalizers,
 * connection field definitions, and bridge config builders.
 */

import type { MachinePlugin, NormalizedMachineStatus } from "./types";
import { bambuPlugin } from "./plugins/bambu";
import { klipperPlugin } from "./plugins/klipper";
import { octoprintPlugin } from "./plugins/octoprint";
import { prusalinkPlugin } from "./plugins/prusalink";
import { grblPlugin } from "./plugins/grbl";

const plugins: Map<string, MachinePlugin> = new Map();

function register(plugin: MachinePlugin) {
  plugins.set(plugin.protocol, plugin);
}

// ── Register all built-in plugins ───────────────────────────────────────────
register(bambuPlugin);
register(klipperPlugin);
register(octoprintPlugin);
register(prusalinkPlugin);
register(grblPlugin);

// ── Public API ──────────────────────────────────────────────────────────────

/** Get a plugin by protocol name. Returns undefined for unknown protocols. */
export function getPlugin(protocol: string): MachinePlugin | undefined {
  return plugins.get(protocol);
}

/** Get all registered plugins. */
export function getAllPlugins(): MachinePlugin[] {
  return Array.from(plugins.values());
}

/** List all registered protocol names. */
export function getProtocolNames(): string[] {
  return Array.from(plugins.keys());
}

/**
 * Normalize a raw status payload using the appropriate protocol plugin.
 * Returns a minimal offline status if the protocol is unknown.
 */
export function normalizeStatus(
  protocol: string,
  raw: Record<string, unknown>
): NormalizedMachineStatus {
  const plugin = plugins.get(protocol);
  if (!plugin) {
    return {
      state: "offline",
      protocol: protocol || "unknown",
      lastUpdated: new Date().toISOString(),
      raw,
    };
  }
  return plugin.normalizeStatus(raw);
}
