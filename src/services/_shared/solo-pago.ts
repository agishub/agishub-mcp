/**
 * Tools que se ANUNCIAN por MCP pero solo se ejecutan pagando.
 *
 * Sirve para las del grupo `web` que necesitan un navegador real —captura, PDF,
 * snapshot, automatización, rastreo— o un modelo de IA. Ejecutarlas gratis
 * costaría dinero en cada llamada, y el servidor recibe miles de llamadas MCP
 * al mes de monitores: `x402-observer` por sí solo hizo 7.701 en 30 días.
 *
 * Aun así se exponen en la lista de tools, porque un servidor MCP llamado «web
 * scraper» que solo enseña tres cosas no parece un producto. El cliente las ve,
 * entiende qué hacen y recibe la llamada exacta para usarlas.
 *
 * No es un error: se devuelve un resultado normal con las instrucciones, para
 * que el agente pueda decidir si pagar en vez de tener que capturar una
 * excepción.
 */

import type { OperationContext } from "../types";

// Alias, no interface: TypeScript solo considera los alias compatibles con
// Record<string, unknown>, que es lo que devuelven los handlers.
export type AvisoDePago = {
  status: "payment_required";
  reason: string;
  endpoint: string;
  price: string;
  network: "base";
  asset: "USDC";
  how_to_call: string;
  docs: string;
};

/**
 * Devuelve el aviso si la llamada viene del canal gratuito; `null` si viene del
 * canal de pago, en cuyo caso el handler debe seguir su curso.
 */
export function avisoSiEsGratis(
  ctx: OperationContext<unknown>,
  seg: string,
  motivo: string,
): AvisoDePago | null {
  if (ctx.transport !== "mcp") return null;
  const precio = ctx.catalog?.pricing?.x402 ?? "";
  return {
    status: "payment_required",
    reason: `${motivo} Por eso esta tool solo se ejecuta en el canal de pago.`,
    endpoint: `https://api.agishub.com/v1/${seg}`,
    price: precio,
    network: "base",
    asset: "USDC",
    how_to_call: `POST https://api.agishub.com/v1/${seg} con el mismo cuerpo JSON. La primera llamada devuelve un reto x402 (HTTP 402); fírmalo y reintenta.`,
    docs: "https://api.agishub.com/openapi.json",
  };
}
