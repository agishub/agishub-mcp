/**
 * Versión estática de `scrape` y `links`: mismo resultado, pero leyendo el HTML
 * tal cual llega, sin levantar un navegador.
 *
 * Es lo que sirve el tramo gratuito de MCP. El eje gratis/pago del scraper ya
 * era ese —`extract` con `render:false` es gratis y con `render:true` se cobra—
 * y aquí se aplica igual: sin JavaScript se ve lo que hay en el HTML de origen;
 * con navegador se ve lo que vería una persona.
 *
 * Importa porque estas dos tools son las únicas del grupo `web` que pueden dar
 * un resultado útil sin navegador. Exponerlas gratis por MCP hace que el
 * servidor sea probable sin que cada llamada de un bot cueste dinero: hoy los
 * monitores hacen miles de llamadas MCP al mes.
 */

import { parse } from "node-html-parser";

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;
const UA = "Mozilla/5.0 (compatible; agishub-webextract/1.0; +https://api.agishub.com)";

export class EstaticoError extends Error {}

/** Descarga el HTML con tope de tiempo y de tamaño. */
async function descargar(url: string): Promise<{ html: string; finalUrl: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
  } catch (e) {
    throw new EstaticoError(`No se pudo descargar la página: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new EstaticoError(`La página respondió HTTP ${res.status}.`);
  const buf = await res.arrayBuffer();
  const trozo = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
  return { html: new TextDecoder("utf-8").decode(trozo), finalUrl: res.url || url };
}

/** `scrape` sin navegador: selectores CSS sobre el HTML de origen. */
export async function scrapeEstatico(url: string, selectors: string[]) {
  const { html, finalUrl } = await descargar(url);
  const root = parse(html, { comment: false });
  const elements = selectors.map((selector) => {
    // Un selector inválido no debe tumbar el resto de la petición.
    let nodos: ReturnType<typeof root.querySelectorAll> = [];
    try {
      nodos = root.querySelectorAll(selector);
    } catch {
      nodos = [];
    }
    const matches = nodos.slice(0, 100).map((el) => ({
      text: el.text.replace(/\s+/g, " ").trim(),
      attributes: { ...el.attributes },
    }));
    return { selector, count: nodos.length, matches };
  });
  return { url: finalUrl, elements, rendered: false, scraped_at: new Date().toISOString() };
}

/** `links` sin navegador: los `href` del HTML, resueltos a absolutos. */
export async function linksEstatico(url: string, excluirExternos = false) {
  const { html, finalUrl } = await descargar(url);
  const root = parse(html, { comment: false });
  const origen = new URL(finalUrl).origin;
  const vistos = new Set<string>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    let abs: string;
    try {
      abs = new URL(href, finalUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/.test(abs)) continue;
    if (excluirExternos && new URL(abs).origin !== origen) continue;
    vistos.add(abs);
  }
  const links = [...vistos];
  return { url: finalUrl, count: links.length, links, rendered: false, fetched_at: new Date().toISOString() };
}
