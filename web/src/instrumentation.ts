/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to initialize the MQTT client connection.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureMqttConnected } = await import("@/lib/mqtt/client");
    ensureMqttConnected();
  }
}
