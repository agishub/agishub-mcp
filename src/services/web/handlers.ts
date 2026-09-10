/**
 * Pure handler for the web service. Validated input in, plain JSON out; the HTTP
 * adapter returns it directly. Extraction logic lives in ./core/extract.
 * Phase 3: Consolidated browser, crawl, and render (screenshot) operations.
 */

import type { z } from "zod";
import type { OperationContext } from "../types";
import { extract as extractCore } from "./core/extract";
import * as Q from "./core/quickactions";
import * as S from "./schemas";
import { freemiumNote } from "../_shared/freemium";
import { avisoSiEsGratis } from "../_shared/solo-pago";
import * as E from "./core/estatico";
import { automate, type Step } from "../browser/core/run";
import { mapCore } from "../crawl/core/map";
import { crawlCore, getCrawlStatus } from "../crawl/core/crawl";
import * as B from "../render/core/browser";
import { catalogEntry } from "../../catalog";

// El precio del scraper se anuncia en los avisos del tramo gratuito. Estaba
// escrito a mano y llevaba tres subidas de retraso ($0.004 frente a $0.03),
// así que quien leía el aviso recibía una cifra falsa.
const PRECIO_SCRAPER = catalogEntry("web.extract")?.pricing?.x402 ?? "";

/** Las operaciones de crawl necesitan bindings (cola, D1); en stdio no los hay. */
function requireEnv(env: Env | undefined): Env {
  if (!env) throw new Error("Esta operación necesita los bindings del Worker y no está disponible por stdio.");
  return env;
}

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
    requireEnv(requireEnv(ctx.env)),
  );

  // Apply freemium gating + upsell message
  const capped = (result as { truncated?: boolean }).truncated === true;
  const nudge =
    render && capped
      ? `Free MCP tier: static fetch, capped at 8,000 chars. For JavaScript rendering and the full document, use the paid HTTP endpoint POST /v1/web-scraper (x402, ${PRECIO_SCRAPER}).`
      : render
        ? `JavaScript rendering is only on the paid HTTP endpoint POST /v1/web-scraper (x402, ${PRECIO_SCRAPER}). Returned the static fetch.`
        : capped
          ? `Free MCP tier: output capped at 8,000 chars. For the full document use the paid HTTP endpoint POST /v1/web-scraper (x402, ${PRECIO_SCRAPER}).`
          : undefined;

  return freemiumNote(ctx, result, {
    truncated: capped && !!nudge,
    upsell: nudge ?? "",
  });
}

// ── Browser Rendering Quick Actions (published on the paid HTTP channel) ───────

// Gratis por MCP: los selectores se aplican al HTML de origen, sin navegador.
// De pago: navegador real, así que se ve también lo que pinta el JavaScript.
export async function scrape(
  ctx: OperationContext<z.infer<typeof S.scrape>>,
): Promise<Record<string, unknown>> {
  if (ctx.transport === "mcp") return E.scrapeEstatico(ctx.input.url, ctx.input.selectors);
  return Q.scrape(ctx.input, ctx.env);
}

// Mismo reparto: gratis los href del HTML, de pago los enlaces ya renderizados
// (y el filtro `visible_only`, que necesita saber qué se ve en pantalla).
export async function links(
  ctx: OperationContext<z.infer<typeof S.links>>,
): Promise<Record<string, unknown>> {
  if (ctx.transport === "mcp") return E.linksEstatico(ctx.input.url, !!ctx.input.exclude_external);
  return Q.links(ctx.input, ctx.env);
}

export async function structured(
  ctx: OperationContext<z.infer<typeof S.structured>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "extract-structured", "Necesita un navegador y un modelo de IA.");
  if (aviso) return aviso;
  return Q.structured(ctx.input, ctx.env);
}

export async function snapshot(
  ctx: OperationContext<z.infer<typeof S.snapshot>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "snapshot", "Necesita renderizar la página en un navegador real.");
  if (aviso) return aviso;
  return Q.snapshot(ctx.input, ctx.env);
}

// ── Consolidated from browser, crawl, render ──────────────────────────────

export async function browser(
  ctx: OperationContext<z.infer<typeof S.automate>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "browser-automate", "Conduce un navegador real paso a paso.");
  if (aviso) return aviso;
  const { url, steps, screenshot } = ctx.input;
  return automate(ctx.env, url, (steps ?? []) as Step[], screenshot ?? false);
}

export async function map(
  ctx: OperationContext<z.infer<typeof S.map>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "crawl-map", "Recorre el sitio con un navegador para descubrir sus URLs.");
  if (aviso) return aviso;
  const { url, limit = 100, include_subdomains = false, search } = ctx.input;

  const result = await mapCore(
    {
      url,
      limit,
      include_subdomains,
      search,
    },
    requireEnv(requireEnv(ctx.env)),
  );

  return {
    url,
    discovered: result.urls.length,
    limit,
    urls: result.urls,
    metadata: result.metadata,
  };
}

export async function crawl(
  ctx: OperationContext<z.infer<typeof S.crawl>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "crawl", "Lanza un rastreo asíncrono que abre muchas páginas en un navegador.");
  if (aviso) return aviso;
  const { url, limit = 100, max_depth = 2, formats = ["markdown"], same_domain = true } = ctx.input;

  const jobId = await crawlCore(
    {
      url,
      limit,
      max_depth,
      formats,
      same_domain,
    },
    requireEnv(requireEnv(ctx.env)),
  );

  return {
    job_id: jobId,
    status: "queued",
    url,
    limit,
    max_depth,
    message: `Crawl queued. Poll GET /v1/crawl/${jobId} to check status and retrieve results.`,
  };
}

export async function screenshot(
  ctx: OperationContext<z.infer<typeof S.screenshot>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "screenshot", "Necesita renderizar la página en un navegador real.");
  if (aviso) return aviso;
  return B.screenshot(ctx.input, ctx.env);
}

export async function extract_structured(ctx: OperationContext<z.infer<typeof S.structured>>) {
  return Q.structured(ctx.input, ctx.env);
}

