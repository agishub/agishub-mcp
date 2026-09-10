/**
 * MCP adapter — trivial. For every operation published on the `mcp` channel it
 * registers a tool that: builds a RequestContext, validates input, authorizes
 * (free/anonymous on MCP), runs the operation handler, and wraps the result.
 * The free-tier cap for find_meeting_slots is an ADAPTER concern: the handler
 * returns all slots; the MCP door cuts to one and points to the paid endpoint.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpOperations } from "../resolver";
import { buildContext } from "../context";
import { authorize } from "../billing";
import { recordCall } from "../analytics";
import type { OperationContext } from "../services/types";
import type { MeetingResult } from "../services/timezone/core/scheduler";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (obj: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
});
const fail = (err: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }],
  isError: true,
});

const FIND_SLOTS = "timezone.find_meeting_slots";

/** Aviso que sustituye al resultado en un servidor de solo pago. */
function avisoDePago(seg: string, precio: string, descripcion: string) {
  return {
    status: "payment_required",
    tool: descripcion,
    reason: "Este servidor MCP anuncia el catálogo; la ejecución va por el endpoint de pago.",
    endpoint: `https://api.agishub.com/v1/${seg}`,
    price: precio,
    network: "base",
    asset: "USDC",
    how_to_call: `POST https://api.agishub.com/v1/${seg} con el mismo cuerpo JSON. La primera llamada devuelve un reto x402 (HTTP 402); fírmalo y reintenta.`,
    free_alternative: "El hub gratuito https://api.agishub.com/mcp ofrece una versión reducida de algunas de estas tools.",
    docs: "https://api.agishub.com/openapi.json",
  };
}

/**
 * Registers MCP tools on `server`. Pass `services` to expose only a subset (e.g.
 * ["timezone"]) so a focused endpoint advertises just its own toolset; omit it to
 * expose every mcp-channel operation (the combined hub).
 *
 * `soloPago` convierte ese servidor en un escaparate: anuncia las tools con su
 * esquema y su descripción, pero NINGUNA se ejecuta por el canal gratuito —
 * devuelven el aviso de pago con el endpoint y el precio. Se corta aquí, antes
 * de llamar al handler, para que la garantía no dependa de que cada handler se
 * acuerde de comprobarlo.
 */
export function registerTools(
  server: McpServer,
  env?: Env,
  services?: string[],
  opts?: { soloPago?: boolean },
): void {
  const todas = mcpOperations();
  const ops = todas.filter((o) => !services || services.includes(o.operationId.split(".")[0]));

  // Un nombre de servicio que no existe no falla: el servidor arranca y sirve una
  // lista vacía. Así estuvieron meses /mcp/timezone, /mcp/memory y /mcp/crypto,
  // filtrando por namespaces anteriores a la migración de taxonomía. Se avisa
  // fuerte para que el siguiente renombrado se note en los logs el mismo día.
  if (services?.length) {
    const existentes = new Set(todas.map((o) => o.operationId.split(".")[0]));
    const fantasma = services.filter((x) => !existentes.has(x));
    if (fantasma.length) {
      console.error(
        `registerTools: servicio(s) inexistente(s) ${fantasma.join(", ")} — ` +
          `este servidor MCP servirá ${ops.length} tools. Servicios válidos: ${[...existentes].sort().join(", ")}`,
      );
    }
  }
  for (const { name, operationId, operation, catalog } of ops) {
    server.tool(name, catalog.description, operation.schema.shape, async (args: unknown) => {
      try {
        const ctx = buildContext("mcp", {}, args, env) as OperationContext<any>;
        ctx.operationId = operationId;
        ctx.operation = operation;
        ctx.catalog = catalog;
        ctx.input = operation.schema.parse(args);
        ctx.principal = await authorize(ctx);
        recordCall(env, operationId, "mcp", false);

        if (opts?.soloPago) {
          return ok(
            avisoDePago(
              catalog.httpPath ?? operationId.split(".")[1],
              catalog.pricing?.x402 ?? "",
              catalog.description,
            ),
          );
        }

        const result = await operation.handler(ctx);

        if (operationId === FIND_SLOTS) {
          const r = result as MeetingResult;
          return ok({
            ...r,
            slots: r.slots.slice(0, 1),
            count: Math.min(r.count, 1),
            free_tier: true,
            upgrade: {
              message: "Free tier returns at most 1 slot. Get ALL matching slots (no cap) via the paid endpoint.",
              endpoint: "https://api.agishub.com/paid/find-meeting-slots",
              method: "POST",
              price: "$0.02 USDC (Base, x402 pay-per-call)",
            },
          });
        }
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    });
  }
}
