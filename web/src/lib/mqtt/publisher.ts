import { getMqttClient } from "./client";

/**
 * Publish a message to a server-to-device topic.
 * All s2d topics follow: fiq/s/{hardwareId}/{channel}
 */
function publish(
  hardwareId: string,
  channel: string,
  payload: Record<string, unknown>,
  options?: { retain?: boolean; qos?: 0 | 1 | 2 }
): void {
  const client = getMqttClient();
  if (!client) {
    console.warn(`[MQTT] Not connected, dropping message to ${channel} for ${hardwareId}`);
    return;
  }

  const topic = `fiq/s/${hardwareId}/${channel}`;
  const message = JSON.stringify(payload);

  client.publish(topic, message, {
    qos: options?.qos ?? 1,
    retain: options?.retain ?? false,
  });
}

// ── Device config push (retained — device gets latest on reconnect) ──────

export function publishConfig(
  hardwareId: string,
  config: Record<string, unknown>
): void {
  publish(hardwareId, "config", config, { retain: true });
}

// ── OTA notification (retained) ──────────────────────────────────────────

export function publishOta(
  hardwareId: string,
  otaInfo: {
    updateAvailable: boolean;
    version?: string;
    url?: string;
    md5?: string;
    size?: number;
    channel?: string;
    releaseNotes?: string;
  }
): void {
  publish(hardwareId, "ota", otaInfo, { retain: true });
}

// ── Scan result ──────────────────────────────────────────────────────────

export function publishScanResult(
  hardwareId: string,
  result: Record<string, unknown>
): void {
  publish(hardwareId, "scan/result", result);
}

// ── Print job ────────────────────────────────────────────────────────────

export function publishPrintJob(
  hardwareId: string,
  job: { jobId: string; templateId?: string | null; labelData?: Record<string, unknown> }
): void {
  publish(hardwareId, "print/job", job);
}

// ── Pairing status ───────────────────────────────────────────────────────

export function publishPairStatus(
  hardwareId: string,
  status: { paired: boolean; pairingCode?: string; stationId?: string; expiresInSeconds?: number }
): void {
  publish(hardwareId, "pair/status", status);
}
