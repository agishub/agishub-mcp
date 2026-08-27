/**
 * x402 payment strategy — the only billing method implemented today. It gates
 * every priced /v1/* and /paid/* endpoint (HEAD/GET/POST) using the same proven
 * setup as before: mainnet settles via Coinbase CDP, and a ResilientFacilitator
 * wraps getSupported() so a slow/unreachable CDP can never hang the 402 build.
 * Prices come from the Catalog (via the Resolver), not a hand-written route table.
 */

import type { MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { zodToJsonSchema } from "zod-to-json-schema";
import { httpOperations } from "../resolver";

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("facilitator timeout")), ms)),
  ]);
}

// Snapshot of CDP's getSupported() captured 2026-07-16 — refresh if CDP changes.
const STATIC_SUPPORTED = {
  kinds: [
    { x402Version: 2, scheme: "exact", network: "eip155:8453" },
    { x402Version: 2, scheme: "upto", network: "eip155:8453", extra: { facilitatorAddress: "0x97AcCe27D5069544480BDe0F04D9F47d7422a016" } },
    { x402Version: 2, scheme: "batch-settlement", network: "eip155:8453", extra: { receiverAuthorizer: "0x3721824a31197dcDD2984cF43b92B6cc8A87c0Fb" } },
    { x402Version: 2, scheme: "exact", network: "eip155:84532" },
    { x402Version: 1, scheme: "exact", network: "base" },
    { x402Version: 1, scheme: "exact", network: "base-sepolia" },
  ],
  extensions: ["bazaar", "builder-code", "eip2612GasSponsoring"],
  signers: {
    "eip155:*": [
      "0x8F5cB67B49555E614892b7233CFdDEBFB746E531",
      "0x97AcCe27D5069544480BDe0F04D9F47d7422a016",
      "0xCA5e87f82B3FA093800e6ad67D621A427D79c70D",
      "0x625d8a65134079f8faAAc39a7947c73d93C6aC39",
    ],
  },
} as const;

class ResilientFacilitator {
  // Seed with the verified snapshot so getSupported() NEVER blocks the 402 build.
  // On cold isolates the CDP getSupported() call could hang well past its timeout
  // (observed 8-30s), which is the only network call on the unpaid /paid path — so
  // we do not wait on it. We serve the snapshot immediately and refresh from the
  // real facilitator once, in the background, capped at 1s. verify()/settle() (real
  // payments only) still go straight to CDP with no timeout.
  private cached: unknown = STATIC_SUPPORTED;
  private tried = false;
  constructor(private upstream: { getSupported(): Promise<unknown>; verify(a: unknown, b: unknown): Promise<unknown>; settle(a: unknown, b: unknown): Promise<unknown> }) {}
  async getSupported(): Promise<unknown> {
    if (!this.tried) {
      this.tried = true;
      // Best-effort refresh: wait at most 1s for CDP; if it answers, adopt its data,
      // otherwise keep the snapshot. Never blocks the caller (fire-and-forget).
      withTimeout(Promise.resolve(this.upstream.getSupported()), 1000)
        .then((s) => {
          if (s && typeof s === "object" && "kinds" in (s as Record<string, unknown>)) this.cached = s;
        })
        .catch(() => {
          /* CDP slow/down — keep the snapshot */
        });
    }
    return this.cached;
  }
  verify(a: unknown, b: unknown) {
    return this.upstream.verify(a, b);
  }
  settle(a: unknown, b: unknown) {
    return this.upstream.settle(a, b);
  }
}

let cachedMw: ReturnType<typeof paymentMiddleware> | null = null;

/**
 * Hono middleware that enforces x402 on the priced routes. Mounted globally; it
 * only acts on paths present in its route table (everything else passes through).
 */
export const x402Middleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const payTo = c.env.X402_PAY_TO;
  if (!payTo) return next();
  if (!cachedMw) {
    const mainnet = (c.env.X402_NETWORK as string) === "base";
    const network = (mainnet ? "eip155:8453" : "eip155:84532") as `${string}:${string}`;
    const upstream =
      mainnet && c.env.CDP_API_KEY_ID && c.env.CDP_API_KEY_SECRET
        ? new HTTPFacilitatorClient(createFacilitatorConfig(c.env.CDP_API_KEY_ID, c.env.CDP_API_KEY_SECRET))
        : new HTTPFacilitatorClient({ url: c.env.X402_FACILITATOR_URL || "https://x402.org/facilitator" });
    // Wrap CDP so getSupported() can't hang the 402 build (timeout + static fallback).
    const facilitatorClient = new ResilientFacilitator(upstream as any);
    // Bazaar discovery is ENABLED (per-route `extensions.bazaar` below), so our paid
    // tools appear in the x402 catalog (CDP facilitator). The historic blocker was
    // ajv's runtime `new Function` (forbidden in Workers), which hung /paid on cold
    // isolates; it is neutralized by a Workers-safe ajv shim wired via wrangler
    // `alias` (src/shims/ajv-shim.mjs). ajv only validates our own discovery schemas,
    // never verify/settle.
    const resourceServer = new x402ResourceServer(facilitatorClient as any).register(
      network,
      new ExactEvmScheme(),
    );

    // Build the priced route table from the Catalog (via the Resolver): each paid
    // operation is exposed at both /v1/<seg> and /paid/<seg> (the legacy alias).
    const routes: Record<string, unknown> = {};
    for (const ep of httpOperations()) {
      const price = ep.catalog.pricing?.x402;
      if (!price) continue;
      const cfg = {
        accepts: { scheme: "exact" as const, price, network, payTo: payTo as `0x${string}` },
        description: ep.catalog.description,
      };
      // Discovery del bazaar: declara cómo se llama esta tool de pago (input JSON
      // Schema desde el zod de la operación) para que el catálogo x402 (facilitador
      // CDP) la indexe. Envuelto en try/catch: un esquema problemático nunca rompe el
      // paywall — como mucho esa ruta no se anuncia.
      let postCfg: unknown = cfg;
      try {
        const bazaar = declareDiscoveryExtension({
          method: "POST",
          bodyType: "json",
          inputSchema: zodToJsonSchema(ep.operation.schema, { target: "openApi3" }) as Record<string, unknown>,
          input: {},
          output: { example: {} },
        } as any);
        postCfg = { ...cfg, extensions: { bazaar } };
      } catch {
        postCfg = cfg;
      }
      for (const base of [`/v1/${ep.seg}`, `/paid/${ep.seg}`]) {
        routes[`HEAD ${base}`] = cfg;
        routes[`GET ${base}`] = cfg;
        routes[`POST ${base}`] = postCfg;
      }
    }
    // syncFacilitatorOnStart must stay ON: the facilitator sync provides the data
    // needed to build the 402 (supported kinds/asset). Disabling it returns 500 on
    // /paid. The cost is a slow first request per cold isolate — mitigated by the
    // cron warmer in index.ts.
    cachedMw = paymentMiddleware(routes as any, resourceServer);
  }
  return cachedMw(c, next);
};
