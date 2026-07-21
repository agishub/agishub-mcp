/**
 * Call counter via Cloudflare Analytics Engine. One data point per operation
 * invocation, tagged by tool, channel (mcp / http / stdio) and kind (free / paid).
 * Best-effort and non-blocking — analytics must never break or slow a request.
 * Aggregate with the AE SQL API (see the /health/calls route).
 */
export function recordCall(
  env: Env | undefined,
  operation: string,
  channel: "mcp" | "http" | "stdio",
  paid: boolean,
): void {
  try {
    env?.AE?.writeDataPoint({
      indexes: [operation],
      blobs: [operation, channel, paid ? "paid" : "free"],
      doubles: [1],
    });
  } catch {
    /* never let analytics break a request */
  }
}
