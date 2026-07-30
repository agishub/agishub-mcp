/**
 * Call counter via Cloudflare Analytics Engine. One data point per operation
 * invocation, tagged by tool, channel (mcp / http / stdio), kind (free / paid)
 * and a hashed caller id (blob4) for distinct-client counts. Best-effort and
 * non-blocking — analytics must never break or slow a request. Aggregate with the
 * AE SQL API (see the /health/calls route).
 */
export function recordCall(
  env: Env | undefined,
  operation: string,
  channel: "mcp" | "http" | "stdio",
  paid: boolean,
  client?: string,
): void {
  try {
    env?.AE?.writeDataPoint({
      indexes: [operation],
      blobs: [operation, channel, paid ? "paid" : "free", client ?? ""],
      doubles: [1],
    });
  } catch {
    /* never let analytics break a request */
  }
}

/**
 * Stable, non-reversible id for a caller, derived from its IP (FNV-1a hash) — used
 * only to COUNT DISTINCT clients per operation. The raw IP is never stored.
 * Returns "" when the IP is unknown (e.g. MCP, where the handler has no request).
 */
export function clientId(headers: Record<string, string>): string {
  const ip = (
    headers["cf-connecting-ip"] ||
    headers["x-real-ip"] ||
    (headers["x-forwarded-for"] || "").split(",")[0] ||
    ""
  ).trim();
  if (!ip) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
