/**
 * Acciones rápidas sobre una página: /scrape (por selector CSS), /links,
 * /json (extracción estructurada con IA) y /snapshot.
 *
 * Antes tiraban de la API REST de Browser Rendering con `CF_API_TOKEN`; ese
 * token perdió el permiso y los cuatro cobraban y fallaban con "Authentication
 * error". Ahora usan el binding `BROWSER` vía `_shared/navegador`, que no lleva
 * credenciales y no puede caducar.
 *
 * Todas levantan un navegador real, así que cada llamada cuesta dinero: el
 * catálogo las publica solo en el canal HTTP de pago, nunca en el MCP gratuito.
 */

import { conNavegador, irA, urlPublica, aBase64, NavegadorError } from "../../_shared/navegador";
import { htmlAMarkdown } from "./extract";

// Se mantiene el nombre histórico del error: los handlers lo capturan por tipo.
export { NavegadorError as QuickActionError };

// ── /scrape — extraer elementos por selector CSS ──────────────────────────────
export interface ScrapeOptions {
  url: string;
  selectors: string[];
}

export async function scrape(o: ScrapeOptions, env?: Env) {
  const url = urlPublica(o.url);
  const elements = await conNavegador(env, "scrape", async (page) => {
    await irA(page, url);
    const salida = [];
    for (const selector of o.selectors) {
      // Un selector que no case (o que sea inválido) no debe tumbar el resto.
      // Este callback se serializa y corre DENTRO del navegador, donde sí existen
      // los tipos del DOM; el tsconfig del Worker no los incluye, de ahí el any.
      const matches = await page
        .$$eval(selector, (els: any[]) =>
          els.map((el) => ({
            text: (el.textContent || "").trim(),
            attributes: Object.fromEntries(Array.from(el.attributes as any[]).map((a: any) => [a.name, a.value])),
          })),
        )
        .catch(() => [] as { text: string; attributes: Record<string, string> }[]);
      salida.push({ selector, count: matches.length, matches });
    }
    return salida;
  });
  return { url, elements, scraped_at: new Date().toISOString() };
}

// ── /links — todos los hipervínculos de la página ─────────────────────────────
export interface LinksOptions {
  url: string;
  visible_only?: boolean;
  exclude_external?: boolean;
}

export async function links(o: LinksOptions, env?: Env) {
  const url = urlPublica(o.url);
  const encontrados: string[] = await conNavegador(env, "links", async (page) => {
    await irA(page, url);
    // Corre dentro del navegador (ver nota en scrape sobre los tipos del DOM).
    return await page.$$eval(
      "a[href]",
      (els: any[], soloVisibles: boolean) =>
        els
          .filter((el) => !soloVisibles || el.getClientRects().length > 0)
          // `href` de la propiedad, no del atributo: ya viene resuelto a absoluto.
          .map((el) => el.href)
          .filter(Boolean),
      !!o.visible_only,
    );
  });

  // El filtro de dominio se hace fuera del navegador, donde tenemos el origen.
  const origen = new URL(url).origin;
  const filtrados = o.exclude_external
    ? encontrados.filter((l) => {
        try {
          return new URL(l).origin === origen;
        } catch {
          return false;
        }
      })
    : encontrados;
  const unicos = [...new Set(filtrados)];
  return { url, count: unicos.length, links: unicos, fetched_at: new Date().toISOString() };
}

// ── /json — extracción estructurada con IA ────────────────────────────────────
export interface StructuredOptions {
  url: string;
  prompt?: string;
  schema?: Record<string, unknown>;
}

const LLM = "@cf/meta/llama-3.1-8b-instruct-fp8";
const MAX_CHARS = 12_000;

export async function structured(o: StructuredOptions, env?: Env) {
  const url = urlPublica(o.url);
  if (!o.prompt && !o.schema) {
    throw new NavegadorError("Provide a 'prompt' and/or a JSON 'schema' describing what to extract.");
  }
  if (!env?.AI) throw new NavegadorError("The AI service is temporarily unavailable.");

  // La REST /json hacía navegación y extracción en un paso. Aquí se separan:
  // el binding trae el HTML y el modelo lo interpreta. Se le pasa markdown en
  // vez de HTML crudo porque cabe mucho más contenido útil en el contexto.
  const html = await conNavegador(env, "json", async (page) => {
    await irA(page, url);
    return (await page.content()) as string;
  });
  const texto = htmlAMarkdown(html, url).slice(0, MAX_CHARS);

  const instruccion = [
    "Extract structured data from the page content below.",
    o.prompt ? `What to extract: ${o.prompt}` : "",
    o.schema ? `Return JSON matching this JSON Schema: ${JSON.stringify(o.schema)}` : "",
    "Answer with raw JSON only — no prose, no markdown fences.",
    "",
    texto,
  ]
    .filter(Boolean)
    .join("\n");

  const r = (await env.AI.run(LLM, { prompt: instruccion })) as { response?: unknown };
  const bruto = typeof r?.response === "string" ? r.response : String(r?.response ?? "");

  // El modelo suele envolver el JSON en ``` pese a pedirle lo contrario.
  const limpio = bruto.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let data: unknown;
  try {
    data = JSON.parse(limpio);
  } catch {
    // Segundo intento: quedarse con el primer objeto o array equilibrado.
    const m = limpio.match(/[[{][\s\S]*[\]}]/);
    try {
      data = m ? JSON.parse(m[0]) : { raw: limpio };
    } catch {
      data = { raw: limpio };
    }
  }
  return { url, data, extracted_at: new Date().toISOString() };
}

// ── /snapshot — HTML + captura (+ markdown / árbol de accesibilidad) ───────────
export interface SnapshotOptions {
  url: string;
  formats?: string[];
  full_page?: boolean;
  width?: number;
  height?: number;
}

export async function snapshot(o: SnapshotOptions, env?: Env) {
  const url = urlPublica(o.url);
  const formats = o.formats && o.formats.length ? o.formats : ["html", "screenshot"];
  const quiere = (f: string) => formats.includes(f);

  const r = await conNavegador(env, "snapshot", async (page) => {
    await page.setViewport({ width: o.width || 1280, height: o.height || 800 });
    await irA(page, url);
    const out: { html?: string; screenshot?: string; a11y?: unknown } = {};
    // El markdown se deriva del HTML, así que hay que capturarlo también.
    if (quiere("html") || quiere("markdown")) out.html = (await page.content()) as string;
    if (quiere("screenshot")) {
      out.screenshot = aBase64(await page.screenshot({ fullPage: !!o.full_page, type: "png" }));
    }
    if (quiere("accessibilityTree") || quiere("accessibility_tree")) {
      out.a11y = await page.accessibility.snapshot();
    }
    return out;
  });

  const out: Record<string, unknown> = { url, formats, captured_at: new Date().toISOString() };
  if (quiere("html") && r.html != null) out.html = r.html;
  if (quiere("markdown") && r.html != null) out.markdown = htmlAMarkdown(r.html, url);
  if (r.a11y != null) out.accessibility_tree = r.a11y;
  if (r.screenshot) {
    out.screenshot = {
      mime: "image/png",
      base64: r.screenshot,
      data_uri: `data:image/png;base64,${r.screenshot}`,
    };
  }
  return out;
}
