/**
 * Cloudflare Browser Rendering "Quick Actions" REST — the JSON-returning
 * endpoints: /scrape, /links, /json (AI extraction) and /snapshot. Reuses the
 * same CF_API_TOKEN + CF_ACCOUNT_ID as the web scraper's render path and the
 * /pdf + /screenshot renders (token needs the "Browser Rendering" permission).
 *
 * These all spin a real headless browser on Cloudflare's side, so every call
 * costs money — hence the catalog publishes them on the paid HTTP channel only,
 * never on the free MCP channel (same policy as render.pdf / render.screenshot).
 */

const TIMEOUT_MS = 30_000;

export class QuickActionError extends Error {}

// ── URL guard (http/https only, block obvious internal hosts) ─────────────────
function assertPublicHttpUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new QuickActionError("URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new QuickActionError("Solo se admiten URLs http/https.");
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    /^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) throw new QuickActionError("Host no permitido (red interna).");
  return u.toString();
}

// ── shared REST call → returns the parsed `result` field ──────────────────────
async function callJson<T = unknown>(
  env: Env | undefined,
  endpoint: "scrape" | "links" | "json" | "snapshot",
  body: Record<string, unknown>,
): Promise<T> {
  const token = env?.CF_API_TOKEN;
  const acct = env?.CF_ACCOUNT_ID;
  if (!token || !acct) {
    throw new QuickActionError(
      "Browser Rendering is not configured (missing CF_API_TOKEN / CF_ACCOUNT_ID).",
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/browser-rendering/${endpoint}`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; result?: T; errors?: unknown }
      | null;
    if (!res.ok || !data || data.success === false) {
      const detail = data?.errors ? JSON.stringify(data.errors).slice(0, 240) : `HTTP ${res.status}`;
      throw new QuickActionError(`Browser Rendering ${endpoint} failed: ${detail}`);
    }
    return data.result as T;
  } catch (e) {
    if (e instanceof QuickActionError) throw e;
    throw new QuickActionError(
      `Browser Rendering ${endpoint} error: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── /scrape — extract elements by CSS selector ────────────────────────────────
export interface ScrapeOptions {
  url: string;
  selectors: string[];
}

interface CfScrapeMatch {
  text?: string;
  html?: string;
  attributes?: { name: string; value: string }[];
}
interface CfScrapeGroup {
  selector: string;
  results?: CfScrapeMatch[];
}

export async function scrape(o: ScrapeOptions, env?: Env) {
  const url = assertPublicHttpUrl(o.url);
  const groups = await callJson<CfScrapeGroup[]>(env, "scrape", {
    url,
    elements: o.selectors.map((selector) => ({ selector })),
  });
  const elements = (groups || []).map((g) => ({
    selector: g.selector,
    count: g.results?.length ?? 0,
    matches: (g.results || []).map((m) => ({
      text: (m.text || "").trim(),
      attributes: Object.fromEntries((m.attributes || []).map((a) => [a.name, a.value])),
    })),
  }));
  return { url, elements, scraped_at: new Date().toISOString() };
}

// ── /links — every hyperlink on the page ──────────────────────────────────────
export interface LinksOptions {
  url: string;
  visible_only?: boolean;
  exclude_external?: boolean;
}

export async function links(o: LinksOptions, env?: Env) {
  const url = assertPublicHttpUrl(o.url);
  const result = await callJson<string[]>(env, "links", {
    url,
    visibleLinksOnly: !!o.visible_only,
    excludeExternalLinks: !!o.exclude_external,
  });
  const list = Array.isArray(result) ? result : [];
  return { url, count: list.length, links: list, fetched_at: new Date().toISOString() };
}

// ── /json — AI-powered structured extraction ──────────────────────────────────
export interface StructuredOptions {
  url: string;
  prompt?: string;
  schema?: Record<string, unknown>;
}

export async function structured(o: StructuredOptions, env?: Env) {
  const url = assertPublicHttpUrl(o.url);
  if (!o.prompt && !o.schema) {
    throw new QuickActionError("Provide a 'prompt' and/or a JSON 'schema' describing what to extract.");
  }
  const body: Record<string, unknown> = { url };
  if (o.prompt) body.prompt = o.prompt;
  if (o.schema) body.response_format = { type: "json_schema", json_schema: o.schema };
  const data = await callJson<Record<string, unknown>>(env, "json", body);
  return { url, data, extracted_at: new Date().toISOString() };
}

// ── /snapshot — HTML + screenshot (+ optional markdown / a11y tree) ───────────
export interface SnapshotOptions {
  url: string;
  formats?: string[];
  full_page?: boolean;
  width?: number;
  height?: number;
}

interface CfSnapshot {
  content?: string;
  screenshot?: string;
  markdown?: string;
  accessibilityTree?: unknown;
}

export async function snapshot(o: SnapshotOptions, env?: Env) {
  const url = assertPublicHttpUrl(o.url);
  const formats = o.formats && o.formats.length ? o.formats : ["html", "screenshot"];
  const body: Record<string, unknown> = {
    url,
    formats,
    viewport: { width: o.width || 1280, height: o.height || 800 },
    screenshotOptions: { fullPage: !!o.full_page, type: "png" },
  };
  const r = await callJson<CfSnapshot>(env, "snapshot", body);
  const out: Record<string, unknown> = { url, formats, captured_at: new Date().toISOString() };
  if (r.content != null) out.html = r.content;
  if (r.markdown != null) out.markdown = r.markdown;
  if (r.accessibilityTree != null) out.accessibility_tree = r.accessibilityTree;
  if (r.screenshot) {
    out.screenshot = { mime: "image/png", base64: r.screenshot, data_uri: `data:image/png;base64,${r.screenshot}` };
  }
  return out;
}
