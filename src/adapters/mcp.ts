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

/**
 * Registers MCP tools on `server`. Pass `services` to expose only a subset (e.g.
 * ["timezone"]) so a focused endpoint advertises just its own toolset; omit it to
 * expose every mcp-channel operation (the combined hub).
 */
export function registerTools(server: McpServer, env?: Env, services?: string[]): void {
  const ops = mcpOperations().filter(
    (o) => !services || services.includes(o.operationId.split(".")[0]),
  );
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
