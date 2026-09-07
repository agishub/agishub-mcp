/**
 * HTTP adapter — trivial. For every operation on the `http` channel it mounts
 * `POST /v1/<seg>` and the legacy alias `POST /paid/<seg>` (plus a GET usage
 * stub). Each handler builds a RequestContext, validates input, authorizes, and
 * runs the operation. The x402 payment gate is applied upstream by x402Middleware.
 * openapi() is generated from the Catalog + zod schemas.
 */

import type { Context, Hono } from "hono";
import { zodToJsonSchema } from "zod-to-json-schema";
import { httpOperations } from "../resolver";
import { buildContext } from "../context";
import { authorize } from "../billing";
import { recordCall, clientId } from "../analytics";
import type { OperationContext } from "../services/types";
import { resolveOperation } from "../services";
import { catalogEntry } from "../catalog";
import { documentoEndpoint } from "../endpoint-doc";

function headersOf(c: Context): Record<string, string> {
  const h: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => {
    h[k.toLowerCase()] = v;
  });
  return h;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Entrada de un GET pagado, leída del query string. Los valores se interpretan
 * como JSON cuando lo son (`?limit=5` → 5, `?raw=true` → true, `?tags=["a"]` →
 * array) y se dejan como texto cuando no (`?timezone=Europe/Madrid`), porque zod
 * no convierte cadenas a números ni a booleanos por su cuenta.
 */
function entradaDeQuery(c: Context): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    try {
      out[k] = JSON.parse(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function mountHttp(app: Hono<{ Bindings: Env }>): void {
  for (const { seg, operationId, operation, catalog } of httpOperations()) {
    const run = (leerEntrada: (c: Context) => Promise<unknown>) => async (c: Context) => {
      const body = await leerEntrada(c);
      const ctx = buildContext("http", headersOf(c), body, c.env) as OperationContext<any>;
      ctx.operationId = operationId;
      ctx.operation = operation;
      ctx.catalog = catalog;
      try {
        ctx.input = operation.schema.parse(body);
      } catch (err) {
        return c.json({ error: errMsg(err) }, 400);
      }
      ctx.principal = await authorize(ctx);
      // Reaching the handler on a priced route means the x402 gate let it through
      // (unpaid requests get a 402 in the middleware), so this is a paid call.
      recordCall(c.env, operationId, "http", true, clientId(ctx.headers));
      try {
        const result = await operation.handler(ctx);
        // Async operations (crawl) return 202 Accepted instead of 200
        const status = operationId === "crawl.crawl" ? 202 : 200;
        return c.json(result as Record<string, unknown>, status);
      } catch (err) {
        return c.json({ error: errMsg(err) }, 400);
      }
    };
    const ejecutarPost = run(async (c) => await c.req.json().catch(() => ({}) as unknown));
    const ejecutarGet = run(async (c) => entradaDeQuery(c));

    for (const base of [`/v1/${seg}`, `/paid/${seg}`]) {
      app.post(base, ejecutarPost);
      // GET también está gateado por x402 (ver billing/x402.ts), así que llegar
      // aquí significa que la llamada está pagada y debe producir el resultado
      // real: los campos se leen del query string. Sin parámetros no hay nada que
      // ejecutar, así que se devuelve el documento autodescriptivo — el mismo que
      // viaja como cuerpo del 402 cuando no se ha pagado.
      app.get(base, (c) =>
        Object.keys(c.req.query()).length
          ? ejecutarGet(c)
          : c.json(documentoEndpoint(base, catalog.description, catalog.pricing?.x402), 200, { allow: "POST" }),
      );
    }
  }

  // Special handling for crawl status endpoint: GET /v1/crawl/:job_id
  const crawlStatusRun = async (c: Context) => {
    const job_id = c.req.param("job_id");
    const ctx = buildContext("http", headersOf(c), { job_id }, c.env) as OperationContext<any>;
    ctx.operationId = "crawl.crawl_status";
    const operation = resolveOperation("crawl.crawl_status");
    const entry = catalogEntry("crawl.crawl_status");
    if (!operation || !entry) {
      return c.json({ error: "Operation not found" }, 404);
    }
    ctx.operation = operation;
    ctx.catalog = entry;
    try {
      ctx.input = operation.schema.parse({ job_id });
    } catch (err) {
      return c.json({ error: errMsg(err) }, 400);
    }
    ctx.principal = await authorize(ctx);
    recordCall(c.env, "crawl.crawl_status", "http", true, clientId(ctx.headers));
    try {
      return c.json((await operation.handler(ctx)) as Record<string, unknown>);
    } catch (err) {
      return c.json({ error: errMsg(err) }, 400);
    }
  };
  app.get("/v1/crawl/:job_id", crawlStatusRun);
  app.get("/paid/crawl/:job_id", crawlStatusRun);
}

export function openapi() {
  const paths: Record<string, unknown> = {};
  for (const { seg, operationId, operation, catalog } of httpOperations()) {
    const price = catalog.pricing?.x402 ?? "";
    const schema = zodToJsonSchema(operation.schema, { target: "openApi3" });
    const def = {
      post: {
        operationId: seg.replace(/[^a-z]/gi, "_"),
        summary: `${catalog.description} (x402 paid, ${price} USDC on Base).`,
        // Extensiones de catálogo: permiten que los ficheros de descubrimiento
        // del sitio (llms.txt) se generen desde aquí en vez de mantenerse a mano.
        // Escritos a mano se quedaron con las rutas de la taxonomía anterior y
        // anunciaban 16 endpoints que ya devolvían 404.
        "x-service": operationId.split(".")[0],
        "x-tool": operationId.split(".")[1],
        "x-category": catalog.category ?? null,
        "x-price": price,
        requestBody: { required: true, content: { "application/json": { schema } } },
        responses: {
          "200": { description: "Success." },
          "402": { description: `Payment required (x402): ${price} USDC on Base.` },
        },
      },
    };
    paths[`/v1/${seg}`] = def;
    paths[`/paid/${seg}`] = def;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "AgisHub",
      version: "2.1.0",
      description:
        "Timezone converter, world clock, date math & meeting scheduler for AI agents. Pay-per-call x402 endpoints (USDC on Base).",
      contact: { name: "AgisHub — Support & Community", url: "https://github.com/agishub/agishub-mcp/discussions", email: "jmavid@gmail.com" },
    },
    externalDocs: { description: "Questions, bug reports & feature requests", url: "https://github.com/agishub/agishub-mcp/discussions" },
    servers: [{ url: "https://api.agishub.com" }],
    paths,
  };
}
