/**
 * timezone-toolkit — Cloudflare Worker entrypoint (wiring only).
 *
 *   POST /mcp, GET /sse           free MCP transport (adapters/mcp)
 *   POST /v1/<op>, /paid/<op>     x402 pay-per-call HTTP (adapters/http)
 *   GET  /                        health page
 *   GET  /openapi.json            discovery document (x402 directories)
 *   GET  /health/*                live health + on-chain payments dashboard
 *
 * Business logic lives in src/services/*, published via src/catalog.ts, resolved
 * by src/resolver.ts, billed by src/billing/*, exposed by src/adapters/*.
 */

import { Hono } from "hono";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./adapters/mcp";
import { mountHttp, openapi } from "./adapters/http";
import { x402Middleware } from "./billing";
import { withTimeout } from "./billing/x402";
import { httpOperations } from "./resolver";
import { mountBackoffice } from "./private/backoffice";

export class TimezoneToolkitMCP extends McpAgent {
  server = new McpServer({ name: "timezone-toolkit", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env);
  }
}

const app = new Hono<{ Bindings: Env }>();

// Billing gate: x402 enforcement on the priced /v1/* and /paid/* routes. Mounted
// globally; only acts on the paths in its route table (built from the Catalog).
app.use(x402Middleware);

// HTTP adapter: mounts /v1/<op> and /paid/<op> for every operation on the http channel.
mountHttp(app);

// Custom domain of the deployed Worker (used by the cron warmer and back-office).
const BASE_URL = "https://timezone-toolkit.agishub.com";

const LANDING = `timezone-toolkit — remote MCP server + x402 paid API

Timezone converter, world clock, date math & meeting scheduler for AI agents.
Free MCP · pay-per-call HTTP (USDC on Base) · IANA/DST-accurate.

MCP:   POST /mcp   (free, 9 tools)   ·   GET /sse (legacy)
Paid:  ${httpOperations()
  .map((e) => `${(e.catalog.pricing?.x402 ?? "").padEnd(7)} POST /paid/${e.seg}`)
  .join("\n       ")}
Docs:  https://github.com/agishub/agishub  ·  /openapi.json
`;
app.get("/", (c) => c.text(LANDING));
app.get("/health", (c) => c.text(LANDING));

app.get("/openapi.json", (c) => c.json(openapi()));
app.get("/.well-known/openapi.json", (c) => c.json(openapi()));

app.get("/favicon.ico", async () => {
  const r = await fetch("https://raw.githubusercontent.com/agishub/agishub/main/logo.png");
  return new Response(r.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
});

// Free MCP transports.
app.all("/mcp", (c) => TimezoneToolkitMCP.serve("/mcp").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/sse", (c) => TimezoneToolkitMCP.serveSSE("/sse").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/sse/message", (c) => TimezoneToolkitMCP.serveSSE("/sse").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));

// Back-office (console, health dashboards, agent tests). Kept out of the public
// repo: src/private/backoffice.ts is a no-op stub upstream; the real file is local.
mountBackoffice(app);
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Warmer: build the payment middleware (and its facilitator sync) on this isolate
    // so real callers don't pay for it. Goes through the SELF service binding.
    ctx.waitUntil(
      (async () => {
        try {
          await withTimeout(env.SELF.fetch(`${BASE_URL}/paid/now-in`), 10000);
        } catch {
          /* best-effort warm */
        }
      })(),
    );
  },
};
