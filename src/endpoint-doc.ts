/**
 * Documento autodescriptivo de un endpoint de pago: qué método usar, cuánto
 * cuesta y dónde está el esquema.
 *
 * Vive aparte porque lo sirven DOS sitios que no pueden importarse entre sí
 * (`adapters/http.ts` importa `billing`, que exporta `billing/x402.ts`):
 *
 *   - `adapters/http.ts`, como respuesta 200 a un GET ya pagado.
 *   - `billing/x402.ts`, como CUERPO del reto 402 de un GET sin pagar.
 *
 * Ese segundo uso es el que importa. Antes GET quedaba sin gatear para que un
 * rastreador se encontrase este documento en vez de un 402 seco; el efecto
 * colateral fue quedarse fuera del registro de descubrimiento de Coinbase, que
 * sondea con GET y exige un 402 (comprobación `returns_402`: obtenía 200 y
 * descartaba el recurso sin llegar a mirar la extensión `bazaar`). Sirviéndolo
 * como cuerpo del 402 se cumplen las dos cosas: el validador ve su 402 y el
 * rastreador sigue leyendo la documentación.
 */

export interface DocEndpoint {
  method: "POST";
  endpoint: string;
  description: string;
  payment: { protocol: "x402"; price: string | null; network: "base"; asset: "USDC" };
  usage: string;
  schema: string;
}

/** `base` es la ruta ya montada, p. ej. `/v1/time-now`. */
export function documentoEndpoint(base: string, description: string, price?: string | null): DocEndpoint {
  return {
    method: "POST",
    endpoint: base,
    description,
    payment: { protocol: "x402", price: price ?? null, network: "base", asset: "USDC" },
    usage: `POST ${base} with a JSON body. An unpaid request returns an x402 HTTP 402 challenge; sign the USDC payment on Base and retry.`,
    schema: "https://api.agishub.com/openapi.json",
  };
}
