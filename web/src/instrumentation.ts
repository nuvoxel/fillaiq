/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to initialize the MQTT client connection.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log(`[Instrumentation] register() called, pid=${process.pid}, runtime=${process.env.NEXT_RUNTIME}`);
    const { ensureMqttConnected } = await import("@/lib/mqtt/client");
    ensureMqttConnected();
  }
}

// Also export onRequestError to keep the instrumentation module active
export function onRequestError(err: Error) {
  console.error("[Instrumentation] Request error:", err.message);
}
