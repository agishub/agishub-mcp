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

import { Hono, type Context } from "hono";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./adapters/mcp";
import { mountHttp, openapi } from "./adapters/http";
import { x402Middleware } from "./billing";
import { withTimeout } from "./billing/x402";
import { httpOperations } from "./resolver";
import { mountBackoffice } from "./private/backoffice";
import { mountTry } from "./try";
import { handleQueue } from "./webhook-consumer";
import {
  shouldTrace, readBodyCapped, callerIp, callerWallet, channelFor, toolFor, writeTrace,
} from "./traces";

// Combined hub — every mcp-channel tool. Kept for back-compat at /mcp.
// (Class name is unchanged to preserve the existing Durable Object migration.)
export class TimezoneToolkitMCP extends McpAgent {
  server = new McpServer({ name: "agishub", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env);
  }
}

// Focused endpoints — one server per capability domain. Each gets its own
// registry entry (com.agishub/timezone-toolkit, com.agishub/web-scraper) with a
// distinct remote URL, which the official registry requires and which keeps each
// listing keyword-focused for discovery.
export class TimezoneMCP extends McpAgent {
  server = new McpServer({ name: "timezone-toolkit", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["timezone"]);
  }
}

export class WebScraperMCP extends McpAgent {
  server = new McpServer({ name: "web-scraper", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["web"]);
  }
}

export class AiMCP extends McpAgent {
  server = new McpServer({ name: "ai-toolkit", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["ai"]);
  }
}

export class MemoryMCP extends McpAgent {
  server = new McpServer({ name: "agent-memory", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["rag"]);
  }
}

export class WebhookMCP extends McpAgent {
  server = new McpServer({ name: "webhook-relay", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["webhook"]);
  }
}

export class CryptoMCP extends McpAgent {
  server = new McpServer({ name: "crypto-prices", version: "2.1.0" });
  async init() {
    registerTools(this.server, this.env as Env, ["crypto"]);
  }
}

const app = new Hono<{ Bindings: Env }>();

// Trazas de uso: una fila en D1 por cada llamada a las superficies de tools.
// Va ANTES del gate x402 para envolver toda la cadena y capturar también los
// retos 402 y la wallet del pagador (cabecera X-PAYMENT). No bloquea la
// respuesta (waitUntil) y nunca rompe la petición.
app.use(async (c, next) => {
  const path = new URL(c.req.url).pathname;
  const ua = c.req.header("user-agent") || "";
  // Solo superficies de cliente; saltar el warmer interno (cron vía SELF).
  if (!shouldTrace(path) || ua === "timezone-toolkit-healthcheck/1.0") return next();

  const start = Date.now();
  const method = c.req.method;
  // Clonar es síncrono y barato; leer los cuerpos (lento) se hace luego en
  // waitUntil para NO añadir latencia al camino de la petición/pago.
  const reqClone = method === "GET" || method === "HEAD" ? null : c.req.raw.clone();

  await next();

  const res = c.res;
  const resClone = res.clone();
  const durationMs = Date.now() - start;
  const h = c.req.raw.headers;
  const meta = {
    ts: new Date().toISOString(),
    method,
    path,
    channel: channelFor(path),
    status: res.status,
    durationMs,
    ip: callerIp(h),
    country: h.get("cf-ipcountry") || "",
    userAgent: ua,
    wallet: callerWallet(h),
    paid: path.startsWith("/paid/") || res.status === 402,
  };
  c.executionCtx.waitUntil(
    (async () => {
      const reqBody = reqClone ? await readBodyCapped(reqClone) : "";
      // Saltar solo el stream persistente GET /sse (no cierra); las respuestas
      // SSE de las POST a /mcp* sí se capturan (se desenvuelven a JSON).
      const respBody = await readBodyCapped(resClone, { skip: path.startsWith("/sse") });
      await writeTrace(c.env, { ...meta, tool: toolFor(path, reqBody), reqBody, respBody });
    })(),
  );
});

// Billing gate: x402 enforcement on the priced /v1/* and /paid/* routes. Mounted
// globally; only acts on the paths in its route table (built from the Catalog).
app.use(x402Middleware);

// HTTP adapter: mounts /v1/<op> and /paid/<op> for every operation on the http channel.
mountHttp(app);

// Public "try it" page (no login) — conversion surface, separate from /console.
mountTry(app);

// Custom domain of the deployed Worker (used by the cron warmer and back-office).
const BASE_URL = "https://api.agishub.com";

// Where callers reach a human: questions, bug reports, feature requests, feedback.
// Surfaced on the landing page, in the OpenAPI contact, and in the non-MCP error
// hint so anyone who touches the API can find a way to talk to us.
const SUPPORT_URL = "https://github.com/agishub/agishub-mcp/discussions";

const LANDING = `AgisHub — remote MCP servers + x402 APIs for AI agents

Focused MCP endpoints:
  POST /mcp/timezone   timezone-toolkit — convert, world clock, offsets, date math, holidays, meeting slots
  POST /mcp/web        web-scraper — fetch any URL as clean markdown
  POST /mcp            combined hub (all tools)   ·   GET /sse (legacy)

x402 pay-per-call HTTP (USDC on Base):
       ${httpOperations()
  .map((e) => `${(e.catalog.pricing?.x402 ?? "").padEnd(7)} POST /paid/${e.seg}`)
  .join("\n       ")}
Request features:  call the MCP tool 'request_feature' — ask for new services, improvements, or report bugs (free)
Docs:  https://github.com/agishub/agishub-mcp  ·  /openapi.json
Talk to us:  ${SUPPORT_URL}  (questions, bugs, requests)
`;
app.get("/", (c) => c.text(LANDING));
app.get("/health", (c) => c.text(LANDING));

app.get("/openapi.json", (c) => c.json(openapi()));
app.get("/.well-known/openapi.json", (c) => c.json(openapi()));

// URL shortener redirect: /s/<code> → the original URL (link.shorten writes to KV).
app.get("/s/:code", async (c) => {
  const target = await c.env.LINKS?.get(c.req.param("code"));
  if (!target) return c.text("Short link not found or expired.", 404);
  return c.redirect(target, 302);
});

app.get("/favicon.ico", async () => {
  const r = await fetch("https://raw.githubusercontent.com/agishub/agishub-mcp/main/logo.png");
  return new Response(r.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
});

// Guard: friendly hint for NON-MCP callers hitting an MCP endpoint.
// Real MCP clients (Claude, Cursor, our own console) always POST with
// 'Accept: text/event-stream' and a spec-compliant 'initialize'. A plain HTTP
// script (e.g. python-requests) does neither and gets an opaque 406/400 from the
// transport. We detect that and point them to the direct pay-per-call HTTP
// endpoint instead. Conservative: only fires on a POST that is clearly non-MCP,
// so compliant clients are never affected.
const MCP_HTTP_HINT: Record<string, { seg: string; ex: unknown }> = {
  timezone: { seg: "now-in", ex: { timezone: "Asia/Tokyo" } },
  web: { seg: "web-scraper", ex: { url: "https://example.com" } },
  ai: { seg: "chat", ex: { prompt: "In one sentence, what is the x402 protocol?" } },
  memory: { seg: "memory-search", ex: { namespace: "demo", query: "capital of France" } },
  webhook: { seg: "webhook-relay", ex: { url: "https://httpbin.org/post", payload: { event: "ping" } } },
  crypto: { seg: "crypto-price", ex: { symbols: "BTC,ETH,SOL" } },
};

async function nonMcpHint(c: Context, svc: string): Promise<Response | null> {
  if (c.req.method !== "POST") return null;
  const notSSE = !(c.req.header("accept") || "").includes("text/event-stream");
  let badInit = false;
  if (!notSSE) {
    try {
      const b = (await c.req.raw.clone().json()) as { method?: string; params?: { protocolVersion?: unknown } };
      if (b?.method === "initialize") badInit = !b.params?.protocolVersion;
    } catch {
      /* non-JSON body: let the transport handle it */
    }
  }
  if (!notSSE && !badInit) return null;
  const h = MCP_HTTP_HINT[svc];
  const direct = h ? `POST ${BASE_URL}/paid/${h.seg}` : `${BASE_URL}/openapi.json`;
  const why = notSSE
    ? "missing 'Accept: application/json, text/event-stream' header"
    : "'initialize' params must include protocolVersion, capabilities and clientInfo";
  return c.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message:
          `This is an MCP (Streamable HTTP) endpoint for MCP clients like Claude or Cursor (${why}). ` +
          `For a plain HTTP script, call the direct pay-per-call endpoint instead: ${direct}`,
      },
      hint: {
        mcp_clients: "Use an MCP client (Claude, Cursor) — the MCP tier is free.",
        http_direct: direct,
        example_body: h?.ex,
        try_live: `${BASE_URL}/try`,
        docs: `${BASE_URL}/openapi.json`,
        support: SUPPORT_URL,
      },
    },
    400,
  );
}

// Free MCP transports.
// Combined hub (all tools) — back-compat.
app.all("/mcp", async (c) => (await nonMcpHint(c, "")) ?? TimezoneToolkitMCP.serve("/mcp").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/sse", (c) => TimezoneToolkitMCP.serveSSE("/sse").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/sse/message", (c) => TimezoneToolkitMCP.serveSSE("/sse").fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
// Focused endpoints — one per capability domain, each its own registry entry.
app.all("/mcp/timezone", async (c) => (await nonMcpHint(c, "timezone")) ?? TimezoneMCP.serve("/mcp/timezone", { binding: "TIMEZONE_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/web", async (c) => (await nonMcpHint(c, "web")) ?? WebScraperMCP.serve("/mcp/web", { binding: "WEB_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/ai", async (c) => (await nonMcpHint(c, "ai")) ?? AiMCP.serve("/mcp/ai", { binding: "AI_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/memory", async (c) => (await nonMcpHint(c, "memory")) ?? MemoryMCP.serve("/mcp/memory", { binding: "MEMORY_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/webhook", async (c) => (await nonMcpHint(c, "webhook")) ?? WebhookMCP.serve("/mcp/webhook", { binding: "WEBHOOK_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));
app.all("/mcp/crypto", async (c) => (await nonMcpHint(c, "crypto")) ?? CryptoMCP.serve("/mcp/crypto", { binding: "CRYPTO_MCP" }).fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext));

// Back-office (console, health dashboards, agent tests). Kept out of the public
// repo: src/private/backoffice.ts is a no-op stub upstream; the real file is local.
mountBackoffice(app);
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  // Queue consumer for webhook.relay — delivers queued webhooks with retries.
  async queue(batch: MessageBatch, env: Env) {
    await handleQueue(batch as MessageBatch<any>, env);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Warmer: build the payment middleware (and its facilitator sync) on this isolate
    // so real callers don't pay for it. Goes through the SELF service binding.
    ctx.waitUntil(
      (async () => {
        try {
          // UA de health-probe → el middleware de trazas lo salta (ruido interno).
          await withTimeout(
            env.SELF.fetch(`${BASE_URL}/paid/now-in`, {
              headers: { "user-agent": "timezone-toolkit-healthcheck/1.0" },
            }),
            10000,
          );
        } catch {
          /* best-effort warm */
        }
      })(),
    );
  },
};
