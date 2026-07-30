/**
 * Webhook relay with guaranteed delivery. `relay` validates the target, records a
 * job in KV (reusing LINKS with a `wh:` prefix) and enqueues it on the Queue; the
 * consumer (src/webhook-consumer.ts) delivers with retries and updates the job.
 */

const KEY = (jobId: string) => `wh:${jobId}`;
const TTL_SECONDS = 60 * 60 * 24 * 7; // keep job status for 7 days

export interface QueuedWebhook {
  jobId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  payload: unknown;
}

function guardUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https targets are allowed.");
  const h = u.hostname.toLowerCase();
  const blocked =
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h === "0.0.0.0" ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (blocked) throw new Error("Refusing to relay to a private/internal address.");
  return u;
}

export async function relay(
  env: Env | undefined,
  url: string,
  payload: unknown,
  method = "POST",
  headers?: Record<string, string>,
) {
  if (!env?.WEBHOOK_QUEUE || !env?.LINKS) throw new Error("Webhook relay is not configured (missing Queue / KV).");
  const target = guardUrl(url);
  const jobId = crypto.randomUUID();
  await env.LINKS.put(
    KEY(jobId),
    JSON.stringify({ status: "queued", url: target.toString(), attempts: 0, created_at: new Date().toISOString() }),
    { expirationTtl: TTL_SECONDS },
  );
  await env.WEBHOOK_QUEUE.send({ jobId, url: target.toString(), method: method.toUpperCase(), headers, payload });
  return { job_id: jobId, status: "queued", target: target.toString(), note: "Poll delivery with webhook_status." };
}

export async function status(env: Env | undefined, jobId: string) {
  if (!env?.LINKS) throw new Error("Webhook relay is not configured (missing KV).");
  const raw = await env.LINKS.get(KEY(jobId));
  if (!raw) return { job_id: jobId, status: "unknown", note: "No such job (or it expired)." };
  return { job_id: jobId, ...(JSON.parse(raw) as Record<string, unknown>) };
}

export async function setStatus(env: Env, jobId: string, patch: Record<string, unknown>) {
  const raw = await env.LINKS.get(KEY(jobId));
  const cur = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  await env.LINKS.put(KEY(jobId), JSON.stringify({ ...cur, ...patch, updated_at: new Date().toISOString() }), {
    expirationTtl: TTL_SECONDS,
  });
}
