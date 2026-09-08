/**
 * Mantiene vivos los endpoints en el registro de descubrimiento de Coinbase.
 *
 * El registro es una VENTANA MÓVIL DE 30 DÍAS: «Resources that go 30 days
 * without a settlement are removed from both the catalog and search results».
 * Verificado además contra el propio registro — el recurso más antiguo de los
 * ~14.400 tenía exactamente 30 días. Sin liquidaciones periódicas AgisHub
 * desaparece de toda la capa de descubrimiento sin previo aviso, que es la
 * única por la que hoy puede encontrarnos un agente.
 *
 * Así que se paga una llamada por endpoint cada UMBRAL_DIAS. Pagador
 * (PAYER_PRIVATE_KEY) y cobrador (X402_PAY_TO) son la misma persona, así que el
 * dinero solo cambia de cartera; el coste real es el gas, que en EIP-3009
 * adelanta el facilitador.
 *
 * Se paga /v1/<seg>, la ruta canónica. Las primeras 34 entradas se indexaron
 * como /paid/<seg> porque es lo que paga el panel de la consola, y ese alias el
 * código lo llama «legacy»: al dejar de refrescarlas, caducan solas en 30 días
 * y el registro queda apuntando solo a /v1. No hay API para borrar entradas.
 *
 * Salvaguardas, porque esto gasta dinero sin que nadie mire:
 *   - un endpoint por ejecución del cron (una por minuto), nunca en ráfaga;
 *   - tope diario duro, por si algo entra en bucle;
 *   - tras 3 fallos seguidos se abandona ese endpoint y se espera intervención:
 *     solo cuentan las llamadas que devuelven 2xx, así que reintentar una rota
 *     es quemar dinero a cambio de nada;
 *   - interruptor en KV (`registro:activo` = "off") para pararlo sin desplegar.
 *
 * El estado se consulta en /health/registro.
 */

import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { httpOperations } from "./resolver";
import { ejemploDeOperacion } from "./billing/bazaar";

/** Se refresca bastante antes de los 30 días reales, para absorber fallos. */
const UMBRAL_DIAS = 20;
const MAX_FALLOS = 3;
const TOPE_DIARIO = 40;
const CLAVE = (seg: string) => `registro:endpoint:${seg}`;

export interface EstadoEndpoint {
  /** Última liquidación con respuesta 2xx: lo único que el registro cuenta. */
  ok?: string;
  ultimoIntento?: string;
  ultimoEstado?: number;
  ultimoError?: string;
  fallos: number;
}

const dias = (desde: string) => (Date.now() - Date.parse(desde)) / 86_400_000;

/** Endpoints que tocan, del más olvidado al menos. */
export async function pendientes(env: Env): Promise<{ seg: string; estado: EstadoEndpoint }[]> {
  const kv = env.LINKS;
  const out: { seg: string; estado: EstadoEndpoint }[] = [];
  for (const ep of httpOperations()) {
    if (!ep.catalog.pricing?.x402) continue;
    const estado = ((await kv?.get(CLAVE(ep.seg), "json")) as EstadoEndpoint | null) ?? { fallos: 0 };
    if (estado.fallos >= MAX_FALLOS) continue;
    if (estado.ok && dias(estado.ok) < UMBRAL_DIAS) continue;
    out.push({ seg: ep.seg, estado });
  }
  // Sin marca previa es el caso más urgente: nunca se ha indexado esa ruta.
  return out.sort((a, b) => (a.estado.ok ? dias(b.estado.ok ?? "") - dias(a.estado.ok) : -1));
}

/**
 * Paga UN endpoint pendiente, si lo hay. Devuelve qué hizo, para la traza del
 * cron. No lanza: un fallo aquí no debe tumbar el resto del scheduled().
 */
export async function refrescarRegistro(env: Env, baseUrl: string): Promise<string> {
  const kv = env.LINKS;
  if (!kv) return "sin KV";
  if ((await kv.get("registro:activo")) === "off") return "desactivado";
  const pk = env.PAYER_PRIVATE_KEY;
  if (!pk) return "sin PAYER_PRIVATE_KEY";

  const hoy = new Date().toISOString().slice(0, 10);
  const gastadas = Number((await kv.get(`registro:gasto:${hoy}`)) || 0);
  if (gastadas >= TOPE_DIARIO) return `tope diario alcanzado (${TOPE_DIARIO})`;

  const cola = await pendientes(env);
  if (!cola.length) return "nada pendiente";
  const { seg, estado } = cola[0];

  const ep = httpOperations().find((o) => o.seg === seg);
  if (!ep) return `segmento desconocido: ${seg}`;
  const cuerpo = ejemploDeOperacion(ep.operation.schema, ep.catalog.description);

  const cuenta = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const red = ((env.X402_NETWORK as string) === "base" ? "eip155:8453" : "eip155:84532") as `${string}:${string}`;
  // Por el binding SELF: un self-fetch al dominio propio da 522.
  const pagar = wrapFetchWithPaymentFromConfig(
    (input: any, init?: any) => env.SELF.fetch(input, init),
    { schemes: [{ network: red, client: new ExactEvmScheme(cuenta) }] },
  );

  const nuevo: EstadoEndpoint = { ...estado, ultimoIntento: new Date().toISOString() };
  try {
    const r = await pagar(`${baseUrl}/v1/${seg}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "agishub-registro-refresh/1.0" },
      body: JSON.stringify(cuerpo),
    });
    nuevo.ultimoEstado = r.status;
    if (r.ok) {
      nuevo.ok = new Date().toISOString();
      nuevo.fallos = 0;
      delete nuevo.ultimoError;
    } else {
      // Solo cuenta un 2xx: un 4xx se ha cobrado y no indexa nada.
      nuevo.fallos = (estado.fallos || 0) + 1;
      nuevo.ultimoError = (await r.text().catch(() => "")).slice(0, 200);
    }
  } catch (e) {
    nuevo.fallos = (estado.fallos || 0) + 1;
    nuevo.ultimoError = e instanceof Error ? e.message : String(e);
  }

  await kv.put(CLAVE(seg), JSON.stringify(nuevo));
  await kv.put(`registro:gasto:${hoy}`, String(gastadas + 1), { expirationTtl: 172_800 });
  return nuevo.ok === nuevo.ultimoIntento || nuevo.ultimoEstado === 200
    ? `refrescado /v1/${seg}`
    : `falló /v1/${seg} (${nuevo.ultimoEstado ?? "sin respuesta"}, fallo ${nuevo.fallos}/${MAX_FALLOS})`;
}
