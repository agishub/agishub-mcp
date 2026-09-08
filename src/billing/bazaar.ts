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

export type JsonSchema = {
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
  minimum?: number;
  maximum?: number;
  description?: string;
};

/**
 * Valor de ejemplo para una propiedad, por nombre y luego por tipo. `padre` es
 * el nombre del objeto que la contiene, y sirve para los campos genéricos: en
 * `date_range: { start, end }` ni `start` ni `end` dicen nada por sí solos y
 * salían como "example", que es basura en el escaparate del registro.
 */
function ejemploDe(nombre: string, p: JsonSchema, prof = 0, padre = "", contexto = "", hermanos = new Set<string>()): unknown {
  if (p.default !== undefined) return p.default;
  if (p.enum?.length) return p.enum[0];
  if (p.anyOf?.length) return ejemploDe(nombre, p.anyOf[0], prof, padre, contexto, hermanos);

  const n = nombre.toLowerCase();
  const tipo = p.type || (p.properties ? "object" : "string");

  if (tipo === "array") {
    if (prof > 2) return [];
    const n0 = Math.max(1, Math.min(p.minItems ?? 1, 3));
    return Array.from({ length: n0 }, () => ejemploDe(nombre, p.items || { type: "string" }, prof + 1, padre, contexto, hermanos));
  }
  if (tipo === "object") {
    if (prof > 2) return {};
    const out: Record<string, unknown> = {};
    // Los hijos heredan este nombre como `padre`: así `start` dentro de
    // `date_range` sale como fecha y no como "example".
    for (const [k, v] of Object.entries(p.properties || {}).slice(0, 6)) out[k] = ejemploDe(k, v, prof + 1, nombre, contexto, new Set(Object.keys(p.properties || {})));
    return out;
  }
  if (tipo === "boolean") return true;
  if (tipo === "number" || tipo === "integer") return numero(n, p);

  // Si el nombre propio no dice nada, se reintenta con el del objeto que lo
  // contiene antes de caer en el genérico.
  let s = cadena(n, p, contexto, hermanos);
  if (s === GENERICO && padre) s = cadena(padre.toLowerCase(), p, contexto, hermanos);
  // El registro valida el ejemplo contra el propio esquema y rechaza el recurso
  // ENTERO si un solo campo se pasa de largo, así que se recorta como red.
  return p.maxLength !== undefined && s.length > p.maxLength ? s.slice(0, p.maxLength) : s;
}

const GENERICO = "example";

/**
 * Valor de ejemplo numérico. Sin esto todo lo que no fuese un límite salía como
 * 1, y `qr.generate` publicaba un QR de 1 píxel por módulo: válido para el
 * esquema, inútil como ejemplo. Se respetan `minimum`/`maximum` porque el
 * registro valida el ejemplo y descarta el recurso entero si no encaja.
 */
function numero(n: string, p: JsonSchema): number {
  let v = 1;
  if (n.includes("limit") || n.includes("max")) v = 5;
  else if (n.includes("width")) v = 1280;
  else if (n.includes("height")) v = 800;
  else if (n.includes("size")) v = 8;
  if (p.maximum !== undefined) v = Math.min(v, p.maximum);
  if (p.minimum !== undefined) v = Math.max(v, p.minimum);
  return v;
}

/** Valor de ejemplo para una propiedad de texto, elegido por el nombre del campo. */
function cadena(n: string, p: JsonSchema, contexto = "", hermanos = new Set<string>()): string {
  // example.com/audio.mp3 no existe (404) y transcribe fallaba al descargarlo.
  // Misma muestra con voz real que usa la consola.
  if (n.includes("audio")) return "https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav";
  if (p.format === "uri" || n.includes("url")) return "https://example.com";
  // Un selector CSS de ejemplo tiene que casar con algo: "example" no casa nada,
  // y era lo que se publicaba para web.scrape.
  if (n.includes("selector")) return "h1";
  if (n.includes("timezone") || n === "tz") return "Europe/Madrid";
  // `from`/`to` significan cosas distintas según el hermano que los acompañe:
  // convert_units lleva `value` (km→mi), currency_convert lleva `amount`
  // (USD→EUR, y ahí el esquema los limita a 3 caracteres) y la conversión
  // horaria lleva `datetime`. Sin mirar el hermano, units-convert publicaba
  // "Europe/Madrid" como unidad de origen y la llamada fallaba.
  if (n === "from" || n === "to") {
    if (hermanos.has("value")) return n === "from" ? "km" : "mi";
    if (hermanos.has("amount") || (p.maxLength !== undefined && p.maxLength <= 3)) {
      return n === "from" ? "USD" : "EUR";
    }
    return n === "from" ? "Europe/Madrid" : "America/New_York";
  }
  // Otros campos de 3 caracteres son códigos, no texto libre.
  if (p.maxLength !== undefined && p.maxLength <= 3) return "USD";
  // Un rango con las dos fechas iguales es válido pero engañoso como ejemplo.
  if (n === "start") return "2026-12-25";
  if (n === "end") return "2026-12-31";
  if (n.includes("date")) return "2026-12-25";
  if (n.includes("country")) return "ES";
  if (n.includes("namespace")) return "demo";
  if (n.includes("symbol")) return "BTC,ETH";
  if (n.includes("currency")) return "USD";
  // `query` no dice por sí solo qué se busca: en time.timezones es un filtro de
  // ciudades y salía preguntando por el protocolo x402. La descripción de la
  // operación es lo único que distingue un caso del otro.
  if (n.includes("prompt") || n.includes("query")) {
    return /timezone|time zone/i.test(contexto) ? "Madrid" : "What is the x402 protocol?";
  }
  if (n.includes("text") || n.includes("content")) return "AgisHub sells agent capabilities per call.";
  // Último recurso antes del genérico: lo que el propio esquema dice del campo.
  // `time.offset` tiene un campo llamado `instant`, que no casa con ninguna regla
  // por nombre, así que se publicaba como "example" y el endpoint devolvía 400 al
  // intentar parsearlo como fecha. Su descripción sí lo delata ("ISO 8601").
  const d = p.description || "";
  if (/ISO ?8601|datetime|timestamp/i.test(d)) return "2026-12-25T10:00:00Z";
  if (/\bdate\b/i.test(d)) return "2026-12-25";
  if (/IANA|timezone|time zone/i.test(d)) return "Europe/Madrid";
  return GENERICO;
}

/**
 * Cuerpo de ejemplo: los campos obligatorios, o los primeros si no hay ninguno.
 *
 * Se completa hasta dos campos con opcionales porque «obligatorio» no siempre
 * basta para que la llamada funcione: en web.extract_structured solo `url` lo
 * es, pero sin `prompt` ni `schema` el endpoint devuelve 400 — y ese ejemplo
 * inservible es el que se publicaba en el registro para que lo copiaran los
 * agentes. Enseñar un parámetro opcional de más nunca estorba; enseñar una
 * llamada que falla, sí.
 */
export function cuerpoEjemplo(js: JsonSchema, contexto = ""): Record<string, unknown> {
  const props = js.properties || {};
  const req = new Set(js.required || []);
  const nombres = Object.keys(props);
  const obligatorios = nombres.filter((n) => req.has(n));
  // Sin ningún campo obligatorio los primeros dos pueden ser alternativas
  // excluyentes: en document.pdf salían `url` y `html` juntos, y el handler
  // ignora el segundo. Con uno solo el ejemplo es una llamada que funciona.
  const elegidos = req.size
    ? [...obligatorios, ...nombres.filter((n) => !req.has(n))].slice(0, Math.max(obligatorios.length, 2))
    : nombres.slice(0, 1);
  const out: Record<string, unknown> = {};
  for (const n of elegidos) out[n] = ejemploDe(n, props[n], 0, "", contexto, new Set(nombres));
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
/** Cuerpo de ejemplo de una operación, a partir de su esquema zod. */
export function ejemploDeOperacion(esquemaZod: unknown, descripcion: string): Record<string, unknown> {
  return cuerpoEjemplo(zodToJsonSchema(esquemaZod as never, { target: "openApi3" }) as JsonSchema, descripcion);
}

export function extensionBazaar(
  esquemaZod: unknown,
  descripcion: string,
  estilo: "body" | "query" = "body",
): ExtensionBazaar {
  const js = zodToJsonSchema(esquemaZod as never, { target: "openApi3" }) as JsonSchema;
  const campos = cuerpoEjemplo(js, descripcion);

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
