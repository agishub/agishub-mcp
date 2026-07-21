/**
 * URL → clean markdown. Pure logic, Workers-safe: fetch (timeout + size cap +
 * basic SSRF guard), parse with node-html-parser (no DOM), strip boilerplate,
 * pick the main content block, and convert HTML to markdown. No transport/auth.
 */

import { parse, NodeType, type HTMLElement } from "node-html-parser";

export interface ExtractOptions {
  url: string;
  render?: boolean;
  include_links?: boolean;
  include_images?: boolean;
  max_chars?: number;
}

export interface ExtractResult {
  url: string;
  final_url: string;
  status: number;
  rendered: boolean;
  title: string | null;
  description: string | null;
  site_name: string | null;
  markdown: string;
  word_count: number;
  char_count: number;
  truncated: boolean;
  fetched_at: string;
}

export class ExtractError extends Error {}

const MAX_BYTES = 2_000_000; // 2 MB response cap
const FETCH_TIMEOUT_MS = 12_000;
const RENDER_TIMEOUT_MS = 25_000;
const UA =
  "Mozilla/5.0 (compatible; timezone-toolkit-webextract/1.0; +https://timezone-toolkit.agishub.com)";

const NOISE_TAGS = [
  "script", "style", "noscript", "svg", "iframe", "form", "nav", "header",
  "footer", "aside", "button", "input", "select", "textarea", "template",
  "link", "meta", "picture", "video", "audio",
];

// ── URL guard ──────────────────────────────────────────────────────────────
function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ExtractError("URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ExtractError("Solo se admiten URLs http/https.");
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    /^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) throw new ExtractError("Host no permitido (red interna).");
  return u;
}

// ── fetch (timeout + size cap) ───────────────────────────────────────────────
async function fetchHtml(u: URL): Promise<{ html: string; finalUrl: string; status: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/plain" },
    });
  } catch (e) {
    throw new ExtractError(`No se pudo descargar la página: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ExtractError(`La página respondió HTTP ${res.status}.`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct && !/text\/html|application\/xhtml|text\/plain/.test(ct)) {
    throw new ExtractError(`Contenido no HTML (content-type: ${ct}).`);
  }

  // Read the body with a hard byte cap so a huge page can't blow the isolate.
  const reader = res.body?.getReader();
  if (!reader) return { html: await res.text(), finalUrl: res.url || u.toString(), status: res.status };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  const html = new TextDecoder("utf-8").decode(buf);
  return { html, finalUrl: res.url || u.toString(), status: res.status };
}

// ── JS rendering via Cloudflare Browser Rendering REST (/content) ─────────────
// Returns rendered HTML, or null if not configured (caller falls back to a plain
// fetch). Reuses CF_API_TOKEN + CF_ACCOUNT_ID; the token needs the "Browser
// Rendering" permission. No heavy puppeteer dependency, so zero bundle/cold-start
// impact for the non-rendered path.
async function renderHtml(env: Env | undefined, u: URL): Promise<{ html: string; finalUrl: string; status: number } | null> {
  const token = env?.CF_API_TOKEN;
  const acct = env?.CF_ACCOUNT_ID;
  if (!token || !acct) return null; // not configured → caller falls back to fetch
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RENDER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/browser-rendering/content`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        url: u.toString(),
        rejectResourceTypes: ["image", "media", "font"],
        gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
      }),
    });
    const data = (await res.json().catch(() => null)) as any;
    const html = typeof data?.result === "string" ? data.result : "";
    if (!res.ok || data?.success === false || !html) return null; // fall back to fetch
    return { html, finalUrl: u.toString(), status: 200 };
  } catch {
    return null; // render failed/timed out → caller falls back to fetch
  } finally {
    clearTimeout(timer);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
type Opts = { links: boolean; images: boolean; base: string };

const tagOf = (n: any): string => (n.rawTagName || n.tagName || "").toLowerCase();
const isEl = (n: any): boolean => n.nodeType === NodeType.ELEMENT_NODE;
const isText = (n: any): boolean => n.nodeType === NodeType.TEXT_NODE;

function absUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function metaContent(root: HTMLElement, selector: string): string | null {
  const el = root.querySelector(selector);
  const v = el?.getAttribute("content");
  return v ? v.trim() : null;
}

const NOISE_SELECTORS = [
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="complementary"]',
  '[role="note"]',
  '[role="banner"]',
  '[role="search"]',
];

function stripNoise(root: HTMLElement): void {
  for (const tag of NOISE_TAGS) {
    for (const el of root.querySelectorAll(tag)) el.remove();
  }
  for (const sel of NOISE_SELECTORS) {
    for (const el of root.querySelectorAll(sel)) el.remove();
  }
}

function pickMain(root: HTMLElement): HTMLElement {
  const candidates: HTMLElement[] = [];
  for (const sel of ["article", "main", '[role="main"]']) {
    const el = root.querySelector(sel);
    if (el) candidates.push(el);
  }
  const body = root.querySelector("body") || root;
  candidates.push(body);
  let best = body;
  let bestLen = -1;
  for (const c of candidates) {
    const ps = c.querySelectorAll("p");
    const len = ps.length ? ps.reduce((s, p) => s + p.text.trim().length, 0) : c.text.trim().length;
    if (len > bestLen) {
      bestLen = len;
      best = c;
    }
  }
  return best;
}

// ── HTML → markdown ────────────────────────────────────────────────────────────
function inline(node: any, o: Opts): string {
  if (isText(node)) return node.text.replace(/\s+/g, " ");
  if (!isEl(node)) return "";
  const tag = tagOf(node);
  const inner = node.childNodes.map((c: any) => inline(c, o)).join("");
  switch (tag) {
    case "strong":
    case "b":
      return inner.trim() ? `**${inner.trim()}**` : "";
    case "em":
    case "i":
      return inner.trim() ? `*${inner.trim()}*` : "";
    case "code":
      return node.text.trim() ? `\`${node.text.trim()}\`` : "";
    case "br":
      return "  \n";
    case "a": {
      const text = inner.trim();
      if (!text) return ""; // skip icon-only / empty links (no [](url) noise)
      const href = node.getAttribute("href");
      if (o.links && href && !/^javascript:/i.test(href)) return `[${text}](${absUrl(href, o.base)})`;
      return text;
    }
    case "img": {
      if (!o.images) return "";
      const src = node.getAttribute("src");
      const alt = node.getAttribute("alt") || "";
      return src ? `![${alt}](${absUrl(src, o.base)})` : "";
    }
    default:
      return inner;
  }
}

function renderList(node: any, o: Opts, depth: number): string {
  const ordered = tagOf(node) === "ol";
  let i = 1;
  let out = "";
  for (const li of node.childNodes) {
    if (!isEl(li) || tagOf(li) !== "li") continue;
    const marker = ordered ? `${i++}.` : "-";
    let inlineStr = "";
    let nested = "";
    for (const c of li.childNodes) {
      const t = tagOf(c);
      if (t === "ul" || t === "ol") nested += renderList(c, o, depth + 1);
      else inlineStr += inline(c, o);
    }
    out += `${"  ".repeat(depth)}${marker} ${inlineStr.replace(/\s+/g, " ").trim()}\n${nested}`;
  }
  return out + "\n";
}

function block(node: any, o: Opts): string {
  if (isText(node)) {
    const t = node.text.replace(/\s+/g, " ").trim();
    return t ? `${t}\n\n` : "";
  }
  if (!isEl(node)) return "";
  const tag = tagOf(node);
  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const s = inline(node, o).trim();
      return s ? `${"#".repeat(Number(tag[1]))} ${s}\n\n` : "";
    }
    case "p": {
      const s = inline(node, o).trim();
      return s ? `${s}\n\n` : "";
    }
    case "hr":
      return "---\n\n";
    case "blockquote": {
      const inner = node.childNodes.map((k: any) => block(k, o)).join("").trim();
      return inner ? `${inner.split("\n").map((l: string) => `> ${l}`).join("\n")}\n\n` : "";
    }
    case "pre": {
      const code = node.text.replace(/\n+$/, "");
      return code.trim() ? `\`\`\`\n${code}\n\`\`\`\n\n` : "";
    }
    case "ul":
    case "ol":
      return renderList(node, o, 0);
    case "li":
      return ""; // handled by its list
    case "table": {
      const rows: string[] = [];
      for (const tr of node.querySelectorAll("tr")) {
        const cells = tr.querySelectorAll("th,td").map((c: any) => inline(c, o).replace(/\s+/g, " ").trim() || " ");
        if (cells.length) rows.push(`| ${cells.join(" | ")} |`);
      }
      if (!rows.length) return "";
      const cols = (rows[0].match(/\|/g)?.length ?? 2) - 1;
      rows.splice(1, 0, `| ${Array(cols).fill("---").join(" | ")} |`);
      return `${rows.join("\n")}\n\n`;
    }
    default:
      // container (div/section/article/figure/…): render its children as blocks
      return node.childNodes.map((k: any) => block(k, o)).join("");
  }
}

// ── public API ────────────────────────────────────────────────────────────────
export async function extract(opts: ExtractOptions, env?: Env): Promise<ExtractResult> {
  const u = assertPublicHttpUrl(opts.url);

  // Rendered path (JS): try Browser Rendering; on any miss, fall back to a plain
  // fetch and report rendered:false so the caller knows JS was not applied.
  let html: string;
  let finalUrl: string;
  let status: number;
  let rendered = false;
  const viaRender = opts.render ? await renderHtml(env, u) : null;
  if (viaRender) {
    ({ html, finalUrl, status } = viaRender);
    rendered = true;
  } else {
    ({ html, finalUrl, status } = await fetchHtml(u));
  }

  const root = parse(html, { comment: false });
  const title =
    metaContent(root, 'meta[property="og:title"]') ||
    root.querySelector("title")?.text.trim() ||
    null;
  const description =
    metaContent(root, 'meta[name="description"]') || metaContent(root, 'meta[property="og:description"]');
  const site_name = metaContent(root, 'meta[property="og:site_name"]');

  stripNoise(root);
  const main = pickMain(root);
  const o: Opts = { links: opts.include_links !== false, images: opts.include_images === true, base: finalUrl };

  let markdown = block(main, o)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const full = markdown.length;
  let truncated = false;
  if (opts.max_chars && opts.max_chars > 0 && markdown.length > opts.max_chars) {
    markdown = markdown.slice(0, opts.max_chars).trimEnd();
    truncated = true;
  }

  return {
    url: opts.url,
    final_url: finalUrl,
    status,
    rendered,
    title,
    description: description ?? null,
    site_name: site_name ?? null,
    markdown,
    word_count: markdown.split(/\s+/).filter(Boolean).length,
    char_count: truncated ? markdown.length : full,
    truncated,
    fetched_at: new Date().toISOString(),
  };
}
