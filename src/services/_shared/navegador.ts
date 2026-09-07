/**
 * Navegador sin cabeza sobre el binding `BROWSER` de Cloudflare.
 *
 * Antes cada servicio llamaba a la API REST de Browser Rendering
 * (`api.cloudflare.com/.../browser-rendering/<acción>`) firmando con
 * `CF_API_TOKEN`. Ese token dejó de tener permiso y los cinco endpoints que
 * dependían de él —scrape, links, snapshot, screenshot y pdf— pasaron a cobrar
 * y devolver `{"code":10000,"message":"Authentication error"}`: dinero cobrado,
 * servicio no prestado. El renderizado JS del scraper caía además en silencio a
 * un fetch plano, así que `render:true` se cobraba sin renderizar nada.
 *
 * El binding no lleva credenciales: lo concede la propia plataforma al Worker,
 * así que no caduca ni hay que rotarlo. `browser-automate` ya lo usaba y era el
 * único de la familia que seguía funcionando.
 *
 * Todo pasa por `conNavegador`, que garantiza el `close()` en `finally`: cada
 * sesión abierta consume cuota de la cuenta hasta que expira sola.
 */

import puppeteer from "@cloudflare/puppeteer";

export const TIMEOUT_MS = 30_000;

export class NavegadorError extends Error {}

/**
 * Solo http/https y nada de red interna. El navegador corre dentro de la
 * infraestructura de Cloudflare, así que una URL apuntando a un host interno es
 * un SSRF: pdf y screenshot no lo comprobaban.
 */
export function urlPublica(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new NavegadorError("URL inválida.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new NavegadorError("Solo se admiten URLs http/https.");
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const esPrivada =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    /^(0\.|127\.|10\.|192\.168\.|169\.254\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (esPrivada) throw new NavegadorError("Host no permitido (red interna).");
  return u.toString();
}

/** Abre una página, ejecuta `fn` y cierra el navegador pase lo que pase. */
export async function conNavegador<T>(
  env: Env | undefined,
  accion: string,
  fn: (page: any) => Promise<T>,
): Promise<T> {
  if (!env?.BROWSER) {
    throw new NavegadorError("Browser Rendering no está configurado (falta el binding BROWSER).");
  }
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    return await fn(page);
  } catch (e) {
    if (e instanceof NavegadorError) throw e;
    throw new NavegadorError(`Browser Rendering ${accion} falló: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Navegación estándar: espera a que la red se calme, con tope de tiempo. */
export async function irA(page: any, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "networkidle0", timeout: TIMEOUT_MS });
}

/** Bytes → base64 por trozos (evita desbordar la pila con ficheros grandes). */
export function aBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
