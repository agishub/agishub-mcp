/**
 * Billing layer. `authorize(ctx)` selects a strategy by INSPECTING THE CONTEXT
 * (its credentials/headers), never by channel — so any transport can carry any
 * auth method. Today only x402 is wired; adding API key / OAuth / enterprise is a
 * new strategy pushed onto `strategies`, with no changes to adapters or handlers.
 *
 * Payment enforcement for x402 (the 402 challenge + settlement) is done by the
 * Hono `x402Middleware`, mounted on the priced routes by the HTTP adapter. Once a
 * request passes that gate, `authorize()` attaches the corresponding Principal.
 */

import type { BillingStrategy, Principal } from "./types";
import type { RequestContext } from "../context";
import { x402Middleware } from "./x402";

function anonymous(): Principal {
  return { type: "anonymous", permissions: [], entitlements: [] };
}

const x402Strategy: BillingStrategy = {
  name: "x402",
  // The x402 client sends its payment authorization in the X-PAYMENT header.
  matches: (ctx) => !!(ctx.headers["x-payment"] || ctx.headers["payment"]),
  authorize: async (ctx) => ({
    type: "x402",
    permissions: ["paid"],
    entitlements: ctx.operationId ? [ctx.operationId] : [],
  }),
};

// Future strategies (API key, OAuth, enterprise) plug in here — each with its own
// matches()/authorize(); the first whose matches(ctx) is true wins.
const strategies: BillingStrategy[] = [x402Strategy];

export async function authorize(ctx: RequestContext): Promise<Principal> {
  for (const s of strategies) {
    if (s.matches(ctx)) return s.authorize(ctx);
  }
  return anonymous();
}

export { x402Middleware };
