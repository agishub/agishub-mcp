/**
 * Extensión `bazaar` del reto x402 — lo que hace descubrible un endpoint en el
 * registro de Coinbase (api.cdp.coinbase.com/platform/v2/x402/discovery).
 *
 * Se construye a mano, como JSON plano, en vez de usar el ayudante de
 * @x402/extensions: ese llama a `validateDiscoveryExtension`, que hace
 * `ajv.compile(schema)`, y ajv compila generando código con `new Function`.
 * Cloudflare Workers lo prohíbe ("Code generation from strings disallowed") y
 * eso colgaba cada llamada /paid en isolates fríos, así que la extensión se
 * había desactivado por completo.
 *
 * La validación que hacía ajv comprobaba que `info` cumpliese `schema`. Aquí
 * ambos salen del MISMO esquema zod de la operación, así que la comprobación es
 * redundante: si el esquema cambia, cambian los dos a la vez.
 *
 * Ojo: estos ejemplos son el escaparate del recurso en el registro, así que un
 * valor malo se publica tal cual. El registro además valida el ejemplo contra
 * el esquema y descarta el recurso ENTERO si un solo campo no encaja.
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
  maxLength?: number;
};

/**
 * Valor de ejemplo para una propiedad, por nombre y luego por tipo. `padre` es
 * el nombre del objeto que la contiene, y sirve para los campos genéricos: en
 * `date_range: { start, end }` ni `start` ni `end` dicen nada por sí solos y
 * salían como "example", que es basura en el escaparate del registro.
 */
function ejemploDe(nombre: string, p: JsonSchema, prof = 0, padre = ""): unknown {
  if (p.default !== undefined) return p.default;
  if (p.enum?.length) return p.enum[0];
  if (p.anyOf?.length) return ejemploDe(nombre, p.anyOf[0], prof, padre);

  const n = nombre.toLowerCase();
  const tipo = p.type || (p.properties ? "object" : "string");

  if (tipo === "array") {
    if (prof > 2) return [];
    const n0 = Math.max(1, Math.min(p.minItems ?? 1, 3));
    return Array.from({ length: n0 }, () => ejemploDe(nombre, p.items || { type: "string" }, prof + 1, padre));
  }
  if (tipo === "object") {
    if (prof > 2) return {};
    const out: Record<string, unknown> = {};
    // Los hijos heredan este nombre como `padre`: así `start` dentro de
    // `date_range` sale como fecha y no como "example".
    for (const [k, v] of Object.entries(p.properties || {}).slice(0, 6)) out[k] = ejemploDe(k, v, prof + 1, nombre);
    return out;
  }
  if (tipo === "boolean") return true;
  if (tipo === "number" || tipo === "integer") return n.includes("limit") || n.includes("max") ? 5 : 1;

  // Si el nombre propio no dice nada, se reintenta con el del objeto que lo
  // contiene antes de caer en el genérico.
  let s = cadena(n, p);
  if (s === GENERICO && padre) s = cadena(padre.toLowerCase(), p);
  // El registro valida el ejemplo contra el propio esquema y rechaza el recurso
  // ENTERO si un solo campo se pasa de largo, así que se recorta como red.
  return p.maxLength !== undefined && s.length > p.maxLength ? s.slice(0, p.maxLength) : s;
}

const GENERICO = "example";

/** Valor de ejemplo para una propiedad de texto, elegido por el nombre del campo. */
function cadena(n: string, p: JsonSchema): string {
  if (n.includes("audio")) return "https://example.com/audio.mp3";
  if (p.format === "uri" || n.includes("url")) return "https://example.com";
  // `from`/`to` son zonas horarias en time.convert pero códigos ISO 4217 en
  // data.currency_convert, y ahí el esquema los limita a 3 caracteres. Sin mirar
  // maxLength salía "Europe/Madrid" como divisa y el registro rechazaba el
  // recurso entero ("String length must be less than or equal to 3").
  if (p.maxLength !== undefined && p.maxLength <= 3) return n === "to" ? "EUR" : "USD";
  if (n.includes("timezone") || n === "tz") return "Europe/Madrid";
  if (n === "from") return "Europe/Madrid";
  if (n === "to") return "America/New_York";
  // Un rango con las dos fechas iguales es válido pero engañoso como ejemplo.
  if (n === "start") return "2026-12-25";
  if (n === "end") return "2026-12-31";
  if (n.includes("date")) return "2026-12-25";
  if (n.includes("country")) return "ES";
  if (n.includes("namespace")) return "demo";
  if (n.includes("symbol")) return "BTC,ETH";
  if (n.includes("currency")) return "USD";
  if (n.includes("prompt") || n.includes("query")) return "What is the x402 protocol?";
  if (n.includes("text") || n.includes("content")) return "AgisHub sells agent capabilities per call.";
  return GENERICO;
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
    input: Record<string, unknown> & { type: "http" };
    output: { type: "json"; example: Record<string, unknown> };
  };
  schema: Record<string, unknown>;
}

/**
 * Construye la extensión para una operación. `schema` describe la forma de
 * `info`, que es lo que el registro valida por su cuenta al indexar.
 *
 * `estilo` debe coincidir con el método de la ruta, porque el middleware
 * sobrescribe `info.input.method` con el de la ruta y quedaría describiendo un
 * GET con cuerpo JSON: "body" para el POST cobrado, "query" para el GET (que
 * lee los mismos campos del query string, ver adapters/http.ts).
 */
export function extensionBazaar(
  esquemaZod: unknown,
  descripcion: string,
  estilo: "body" | "query" = "body",
): ExtensionBazaar {
  const js = zodToJsonSchema(esquemaZod as never, { target: "openApi3" }) as JsonSchema;
  const campos = cuerpoEjemplo(js);

  return {
    info: {
      input:
        estilo === "query"
          ? { type: "http", method: "GET", queryParams: campos }
          : { type: "http", method: "POST", bodyType: "json", body: campos },
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
            method: { type: "string", enum: [estilo === "query" ? "GET" : "POST"] },
            // Los campos reales de la operación, tal cual los describe su esquema zod.
            ...(estilo === "query"
              ? { queryParams: (js as Record<string, unknown>) ?? { type: "object" } }
              : {
                  bodyType: { type: "string", enum: ["json"] },
                  body: (js as Record<string, unknown>) ?? { type: "object" },
                }),
          },
          required: estilo === "query" ? ["type", "method", "queryParams"] : ["type", "method", "bodyType", "body"],
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
