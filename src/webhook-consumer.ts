/**
 * Queue consumer for webhook.relay. Delivers each queued webhook, retrying on
 * failure (network error or non-2xx) up to MAX_ATTEMPTS, and records the outcome
 * on the job's KV status so the caller can poll webhook_status.
 */
import { setStatus, type QueuedWebhook } from "./services/webhook/core/relay";

const MAX_ATTEMPTS = 5;

export async function handleQueue(batch: MessageBatch<QueuedWebhook>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    const { jobId, url, method, headers, payload } = msg.body;
    try {
      const res = await fetch(url, {
        method: method || "POST",
        headers: { "content-type": "application/json", ...(headers || {}) },
        body: typeof payload === "string" ? payload : JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        await setStatus(env, jobId, { status: "delivered", http_status: res.status, attempts: msg.attempts });
        msg.ack();
      } else if (msg.attempts >= MAX_ATTEMPTS) {
        await setStatus(env, jobId, { status: "failed", http_status: res.status, attempts: msg.attempts });
        msg.ack();
      } else {
        await setStatus(env, jobId, { status: "retrying", http_status: res.status, attempts: msg.attempts });
        msg.retry();
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (msg.attempts >= MAX_ATTEMPTS) {
        await setStatus(env, jobId, { status: "failed", error, attempts: msg.attempts });
        msg.ack();
      } else {
        await setStatus(env, jobId, { status: "retrying", error, attempts: msg.attempts });
        msg.retry();
      }
    }
  }
}
