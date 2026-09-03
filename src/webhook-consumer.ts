/**
 * Queue consumer for:
 * - webhook.relay: delivers webhooks
 * - crawl: processes pages for /v1/crawl jobs
 *
 * Routes messages by action field. Retries on failure up to MAX_ATTEMPTS.
 */
import { setStatus, type QueuedWebhook } from "./services/webhook/core/relay";
import { handleCrawlQueueMessage, type CrawlPageMessage } from "./services/crawl/core/queue-consumer";

const MAX_ATTEMPTS = 5;

export async function handleQueue(
  batch: MessageBatch<QueuedWebhook | CrawlPageMessage>,
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    const body = msg.body as any;

    // Route by action field
    if (body.action === "crawl_page") {
      await handleCrawlQueueMessage(msg as Message<CrawlPageMessage>, env);
      continue;
    }

    // Handle webhooks (legacy)
    const { jobId, url, method, headers, payload } = body as QueuedWebhook;
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
