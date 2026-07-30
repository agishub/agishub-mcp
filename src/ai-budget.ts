/**
 * Daily Workers AI budget guard.
 *
 * Cloudflare gives 10,000 free Neurons/day (shared across all AI); beyond that it
 * bills $0.011 / 1,000 Neurons. Cloudflare does not expose a real-time neuron
 * counter to the Worker, so we keep our own per-day ESTIMATED-neuron counter in KV.
 *
 * On the FREE MCP channel we refuse AI calls once the free allowance is (estimated)
 * used up — so free MCP usage never causes an overage charge. Paid HTTP (x402)
 * always runs: its small neuron cost is already covered by the payment.
 */
import type { OperationContext } from "./services/types";

const BLOCK_AT = 9500; // block a bit before the 10,000 free daily Neurons (estimates are approximate)

// Conservative per-call neuron estimates by workload (deliberately on the high side
// so we stop before, not after, the real limit).
const EST: Record<string, number> = { text: 40, embed: 10, audio: 220, image: 4500 };

const dayKey = () => "ain:" + new Date().toISOString().slice(0, 10);

/**
 * Short, consistent "free limit reached → switch to paid" message for any metered
 * service, pointing at the tool's own paid x402 endpoint so the caller can continue.
 * Reuse this from future per-service MCP caps for a uniform message.
 */
export function freeLimitMessage(ctx: OperationContext<unknown>): string {
  const seg = ctx.catalog?.httpPath;
  const endpoint = seg ? `POST https://api.agishub.com/paid/${seg}` : "the paid x402 endpoint";
  return `Free daily limit reached. To continue, switch to the paid x402 endpoint: ${endpoint} (pay-per-call in USDC on Base).`;
}

export async function runAi(
  ctx: OperationContext<unknown>,
  model: string,
  inputs: Record<string, unknown>,
  kind: keyof typeof EST,
): Promise<unknown> {
  const ai = ctx.env?.AI;
  if (!ai) throw new Error("Workers AI is not configured (missing AI binding).");
  const kv = ctx.env?.LINKS;

  // Guard: on the free MCP channel, stop once today's free allowance is used up.
  if (ctx.transport === "mcp" && kv) {
    const used = Number(await kv.get(dayKey())) || 0;
    if (used >= BLOCK_AT) {
      throw new Error(freeLimitMessage(ctx));
    }
  }

  const res = await ai.run(model, inputs);

  // Charge the estimate against today's counter (both channels count toward the
  // shared 10k free allowance). Reused LINKS KV; key expires after ~36h.
  if (kv) {
    const used = Number(await kv.get(dayKey())) || 0;
    await kv.put(dayKey(), String(used + (EST[kind] || 40)), { expirationTtl: 60 * 60 * 36 });
  }
  return res;
}
