/**
 * Cloudflare Browser Rendering REST — PDF and screenshot. Reuses the same
 * CF_API_TOKEN + CF_ACCOUNT_ID as the web scraper's JS-render path (token needs
 * the "Browser Rendering" permission). The /pdf and /screenshot endpoints return
 * the file as raw bytes, which we base64-encode so the result fits in JSON.
 */

const TIMEOUT_MS = 30_000;

export class RenderError extends Error {}

async function callBinary(
  env: Env | undefined,
  endpoint: "pdf" | "screenshot",
  body: Record<string, unknown>,
): Promise<ArrayBuffer> {
  const token = env?.CF_API_TOKEN;
  const acct = env?.CF_ACCOUNT_ID;
  if (!token || !acct) {
    throw new RenderError("Browser Rendering is not configured (missing CF_API_TOKEN / CF_ACCOUNT_ID).");
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
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new RenderError(`Browser Rendering ${endpoint} failed (${res.status}): ${t.slice(0, 240)}`);
    }
    return await res.arrayBuffer();
  } catch (e) {
    if (e instanceof RenderError) throw e;
    throw new RenderError(`Browser Rendering ${endpoint} error: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export interface PdfOptions {
  url?: string;
  html?: string;
  landscape?: boolean;
  format?: string;
}

export async function pdf(o: PdfOptions, env?: Env) {
  if (!o.url && !o.html) throw new RenderError("Provide either 'url' or 'html'.");
  const body: Record<string, unknown> = o.url ? { url: o.url } : { html: o.html };
  body.pdfOptions = { landscape: !!o.landscape, format: o.format || "A4", printBackground: true };
  const buf = await callBinary(env, "pdf", body);
  const base64 = toBase64(buf);
  return {
    format: "pdf",
    source: o.url ? "url" : "html",
    bytes: buf.byteLength,
    mime: "application/pdf",
    base64,
    data_uri: `data:application/pdf;base64,${base64}`,
    generated_at: new Date().toISOString(),
  };
}

export interface ScreenshotOptions {
  url: string;
  full_page?: boolean;
  width?: number;
  height?: number;
}

export async function screenshot(o: ScreenshotOptions, env?: Env) {
  const body: Record<string, unknown> = {
    url: o.url,
    screenshotOptions: { fullPage: !!o.full_page, type: "png" },
    viewport: { width: o.width || 1280, height: o.height || 800 },
  };
  const buf = await callBinary(env, "screenshot", body);
  const base64 = toBase64(buf);
  return {
    format: "png",
    url: o.url,
    full_page: !!o.full_page,
    bytes: buf.byteLength,
    mime: "image/png",
    base64,
    data_uri: `data:image/png;base64,${base64}`,
    generated_at: new Date().toISOString(),
  };
}
