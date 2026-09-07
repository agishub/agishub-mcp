/**
 * PDF y captura de pantalla sobre el binding `BROWSER`.
 *
 * Antes usaban la API REST de Browser Rendering con `CF_API_TOKEN`; ese token
 * perdió el permiso y ambos endpoints cobraban y devolvían "Authentication
 * error". El binding no lleva credenciales, así que no puede caducar.
 *
 * Los ficheros se devuelven en base64 para que quepan en la respuesta JSON.
 */

import { conNavegador, irA, urlPublica, aBase64, NavegadorError } from "../../_shared/navegador";

// Se mantiene el nombre histórico del error: los handlers lo capturan por tipo.
export { NavegadorError as RenderError };

export interface PdfOptions {
  url?: string;
  html?: string;
  landscape?: boolean;
  format?: string;
}

export async function pdf(o: PdfOptions, env?: Env) {
  if (!o.url && !o.html) throw new NavegadorError("Provide either 'url' or 'html'.");
  const url = o.url ? urlPublica(o.url) : null;

  const bytes = await conNavegador(env, "pdf", async (page) => {
    // Con `html` no se navega: se inyecta el documento tal cual y se espera a
    // que carguen sus recursos externos (hojas de estilo, tipografías).
    if (url) await irA(page, url);
    else await page.setContent(o.html as string, { waitUntil: "networkidle0" });
    return (await page.pdf({
      landscape: !!o.landscape,
      format: o.format || "A4",
      printBackground: true,
    })) as Uint8Array;
  });

  const base64 = aBase64(bytes);
  return {
    format: "pdf",
    source: o.url ? "url" : "html",
    bytes: bytes.length,
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
  const url = urlPublica(o.url);
  const bytes = await conNavegador(env, "screenshot", async (page) => {
    await page.setViewport({ width: o.width || 1280, height: o.height || 800 });
    await irA(page, url);
    return (await page.screenshot({ fullPage: !!o.full_page, type: "png" })) as Uint8Array;
  });

  const base64 = aBase64(bytes);
  return {
    format: "png",
    url: o.url,
    full_page: !!o.full_page,
    bytes: bytes.length,
    mime: "image/png",
    base64,
    data_uri: `data:image/png;base64,${base64}`,
    generated_at: new Date().toISOString(),
  };
}
