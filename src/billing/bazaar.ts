/**
 * Extensión `bazaar` del reto x402 — lo que hace descubrible un endpoint en el
 * registro de Coinbase (api.cdp.coinbase.com/platform/v2/x402/discovery).
 *
 * Se construye a mano, como JSON plano, en vez de usar el ayudante de
 * @x402/extensions: ese llama a `validateDiscoveryExtension`, que hace
 * `ajv.compile(schema)`, y ajv compila generando código con `new Function`.
 * Cloudflare Workers lo prohíbe ("Code generation from strings disallowed") y
 * eso colgaba cada llamada /paid en isolates fríos, así que la extensión se
 * había desactivado por completo. El precio de esa decisión fue quedarse fuera
 * del registro: 14.664 recursos indexados, ninguno de AgisHub.
 *
 * La validación que hacía ajv comprobaba que `info` cumpliese `schema`. Aquí
 * ambos salen del MISMO esquema zod de la operación, así que la comprobación es
 * redundante: si el esquema cambia, cambian los dos a la vez.
 *
 * Todo esto se calcula UNA VEZ al construir la tabla de rutas, nunca por
 * petición, que es lo que hacía insufrible la versión anterior.
 */

import { zodToJsonSchema } from "zod-to-json-schema";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  default?: unknown;
  format?: string;
  minItems?: number;
  minLength?: number;
};

/** Valor de ejemplo para una propiedad, por nombre y luego por tipo. */
function ejemploDe(nombre: string, p: JsonSchema, prof = 0): unknown {
  if (p.default !== undefined) return p.default;
  if (p.enum?.length) return p.enum[0];
  if (p.anyOf?.length) return ejemploDe(nombre, p.anyOf[0], prof);

  const n = nombre.toLowerCase();
  const tipo = p.type || (p.properties ? "object" : "string");

  if (tipo === "array") {
    if (prof > 2) return [];
    const n0 = Math.max(1, Math.min(p.minItems ?? 1, 3));
    return Array.from({ length: n0 }, () => ejemploDe(nombre, p.items || { type: "string" }, prof + 1));
  }
  if (tipo === "object") {
    if (prof > 2) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p.properties || {}).slice(0, 6)) out[k] = ejemploDe(k, v, prof + 1);
    return out;
  }
  if (tipo === "boolean") return true;
  if (tipo === "number" || tipo === "integer") return n.includes("limit") || n.includes("max") ? 5 : 1;

  if (n.includes("audio")) return "https://example.com/audio.mp3";
  if (p.format === "uri" || n.includes("url")) return "https://example.com";
  if (n.includes("timezone") || n === "tz") return "Europe/Madrid";
  if (n === "from") return "Europe/Madrid";
  if (n === "to") return "America/New_York";
  if (n.includes("date")) return "2026-12-25";
  if (n.includes("country")) return "ES";
  if (n.includes("namespace")) return "demo";
  if (n.includes("symbol")) return "BTC,ETH";
  if (n.includes("currency")) return "USD";
  if (n.includes("prompt") || n.includes("query")) return "What is the x402 protocol?";
  if (n.includes("text") || n.includes("content")) return "AgisHub sells agent capabilities per call.";
  return "example";
}

/** Cuerpo de ejemplo: los campos obligatorios, o los primeros si no hay ninguno. */
function cuerpoEjemplo(js: JsonSchema): Record<string, unknown> {
  const props = js.properties || {};
  const req = new Set(js.required || []);
  const nombres = Object.keys(props);
  const elegidos = req.size ? nombres.filter((n) => req.has(n)) : nombres.slice(0, 2);
  const out: Record<string, unknown> = {};
  for (const n of elegidos) out[n] = ejemploDe(n, props[n]);
  return out;
}

export interface ExtensionBazaar {
  info: {
    input: { type: "http"; method: "POST"; bodyType: "json"; body: Record<string, unknown> };
    output: { type: "json"; example: Record<string, unknown> };
  };
  schema: Record<string, unknown>;
}

/**
 * Construye la extensión para una operación. `schema` describe la forma de
 * `info`, que es lo que el registro valida por su cuenta al indexar.
 */
export function extensionBazaar(esquemaZod: unknown, descripcion: string): ExtensionBazaar {
  const js = zodToJsonSchema(esquemaZod as never, { target: "openApi3" }) as JsonSchema;
  const body = cuerpoEjemplo(js);

  return {
    info: {
      input: { type: "http", method: "POST", bodyType: "json", body },
      output: { type: "json", example: { result: descripcion.slice(0, 120) } },
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        input: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["http"] },
            method: { type: "string", enum: ["POST"] },
            bodyType: { type: "string", enum: ["json"] },
            // El cuerpo real de la operación, tal cual lo describe su esquema zod.
            body: (js as Record<string, unknown>) ?? { type: "object" },
          },
          required: ["type", "method", "bodyType", "body"],
        },
        output: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["json"] },
            example: { type: "object" },
          },
          required: ["type", "example"],
        },
      },
      required: ["input", "output"],
    },
  };
}
