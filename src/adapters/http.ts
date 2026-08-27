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

function headersOf(c: Context): Record<string, string> {
  const h: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => {
    h[k.toLowerCase()] = v;
  });
  return h;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function mountHttp(app: Hono<{ Bindings: Env }>): void {
  for (const { seg, operationId, operation, catalog } of httpOperations()) {
    const run = async (c: Context) => {
      const body = await c.req.json().catch(() => ({}) as unknown);
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
        return c.json((await operation.handler(ctx)) as Record<string, unknown>);
      } catch (err) {
        return c.json({ error: errMsg(err) }, 400);
      }
    };
    for (const base of [`/v1/${seg}`, `/paid/${seg}`]) {
      app.post(base, run);
      app.get(base, (c) => c.json({ usage: `POST ${base} — see /openapi.json for parameters.` }));
    }
  }
}

export function openapi() {
  const paths: Record<string, unknown> = {};
  for (const { seg, operation, catalog } of httpOperations()) {
    const price = catalog.pricing?.x402 ?? "";
    const schema = zodToJsonSchema(operation.schema, { target: "openApi3" });
    const def = {
      post: {
        operationId: seg.replace(/[^a-z]/gi, "_"),
        summary: `${catalog.description} (x402 paid, ${price} USDC on Base).`,
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
      title: "timezone-toolkit",
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
