/**
 * Pure handler for the web service. Validated input in, plain JSON out; the HTTP
 * adapter returns it directly. Extraction logic lives in ./core/extract.
 */

import type { z } from "zod";
import type { OperationContext } from "../types";
import { extract as extractCore } from "./core/extract";
import * as Q from "./core/quickactions";
import * as S from "./schemas";
import { freemiumNote } from "../_shared/freemium";

/**
 * Free-tier cap for the MCP channel. Enough to prototype and read most articles,
 * but big pages get truncated with an upgrade nudge toward the paid endpoint,
 * which returns the full document (and can render JavaScript).
 */
const FREE_MAX_CHARS = 8000;

export async function extract(ctx: OperationContext<z.infer<typeof S.extract>>) {
  const { url, render, include_links, include_images, max_chars } = ctx.input;
  const mcp = ctx.transport === "mcp";

  // ── Freemium split ─────────────────────────────────────────────────────────
  // Free (MCP): static fetch only, capped to FREE_MAX_CHARS. JavaScript rendering
  //   uses (metered) Browser Rendering, so it's reserved for the paid channel and
  //   free usage can't run up a bill.
  // Paid (x402 HTTP): honours render + returns the full document (no free cap).
  const effectiveMax = mcp
    ? Math.min(max_chars ?? FREE_MAX_CHARS, FREE_MAX_CHARS)
    : max_chars;

  const result = await extractCore(
    { url, render: mcp ? false : render, include_links, include_images, max_chars: effectiveMax },
    ctx.env,
  );

  // Apply freemium gating + upsell message
  const capped = (result as { truncated?: boolean }).truncated === true;
  const nudge =
    render && capped
      ? "Free MCP tier: static fetch, capped at 8,000 chars. For JavaScript rendering and the full document, use the paid HTTP endpoint POST /v1/web-scraper (x402, $0.004)."
      : render
        ? "JavaScript rendering is only on the paid HTTP endpoint POST /v1/web-scraper (x402, $0.004). Returned the static fetch."
        : capped
          ? "Free MCP tier: output capped at 8,000 chars. For the full document use the paid HTTP endpoint POST /v1/web-scraper (x402, $0.004)."
          : undefined;

  return freemiumNote(ctx, result, {
    truncated: capped && !!nudge,
    upsell: nudge ?? "",
  });
}

// ── Browser Rendering Quick Actions (published on the paid HTTP channel) ───────

export function scrape(ctx: OperationContext<z.infer<typeof S.scrape>>) {
  return Q.scrape(ctx.input, ctx.env);
}

export function links(ctx: OperationContext<z.infer<typeof S.links>>) {
  return Q.links(ctx.input, ctx.env);
}

export function structured(ctx: OperationContext<z.infer<typeof S.structured>>) {
  return Q.structured(ctx.input, ctx.env);
}

export function snapshot(ctx: OperationContext<z.infer<typeof S.snapshot>>) {
  return Q.snapshot(ctx.input, ctx.env);
}
