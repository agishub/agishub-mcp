/**
 * Trazas de uso — una fila en D1 (agishub-traces, binding TRACES) por cada
 * llamada a las superficies de tools (/mcp*, /sse, /paid/*, /v1/*, /s/*).
 *
 * Registra QUIÉN llama (IP, país, user-agent, wallet del pagador x402), CUÁNDO
 * (ISO 8601 con milisegundos), QUÉ (método, ruta, tool, canal) y el RESULTADO
 * (status, duración, cuerpos de petición y respuesta truncados).
 *
 * Es best-effort y NO bloqueante: se escribe vía ctx.waitUntil y va en su propio
 * try/catch — las trazas nunca deben romper ni ralentizar una petición real.
 */

const MAX_BODY = 200_000; // caracteres almacenados por cuerpo (petición/respuesta completas)
const MAX_READ = 300_000; // por encima de esto no leemos (imágenes/PDF base64 enormes)

/** ¿Trazamos esta ruta? Solo superficies de cliente; no consola/estáticos/health. */
export function shouldTrace(path: string): boolean {
  return (
    path === "/mcp" ||
    path.startsWith("/mcp/") ||
    path.startsWith("/sse") ||
    path.startsWith("/paid/") ||
    path.startsWith("/v1/") ||
    path.startsWith("/s/")
  );
}

function truncate(s: string): string {
  return s.length <= MAX_BODY ? s : s.slice(0, MAX_BODY) + `…[${s.length} chars, truncado]`;
}

/** Lee el cuerpo (clonando) con tope; salta streams (SSE) y cuerpos enormes. */
export async function readBodyCapped(r: Request | Response): Promise<string> {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) return "";
  const len = Number(r.headers.get("content-length") || "0");
  if (len > MAX_READ) return `[${len} bytes · no guardado]`;
  try {
    return truncate(await r.clone().text());
  } catch {
    return "";
  }
}

/** IP pública del cliente (Cloudflare edge). */
export function callerIp(h: Headers): string {
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0] ||
    ""
  ).trim();
}

/**
 * Dirección de la wallet del pagador desde la cabecera X-PAYMENT (x402). La
 * cabecera es base64 de un JSON con la autorización firmada (EIP-3009), cuyo
 * campo `from` es la wallet del cliente. Best-effort: busca la primera 0x…40hex.
 */
export function callerWallet(h: Headers): string {
  const raw = h.get("x-payment") || h.get("payment") || "";
  if (!raw) return "";
  try {
    return findAddress(JSON.parse(atob(raw))) || "";
  } catch {
    return "";
  }
}

function findAddress(o: unknown): string {
  if (typeof o === "string") return /^0x[a-fA-F0-9]{40}$/.test(o) ? o : "";
  if (o && typeof o === "object") {
    const obj = o as Record<string, unknown>;
    for (const k of ["from", "payer", "address", "signer"]) {
      const v = obj[k];
      if (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v)) return v;
    }
    for (const k of Object.keys(obj)) {
      const r = findAddress(obj[k]);
      if (r) return r;
    }
  }
  return "";
}

export function channelFor(path: string): string {
  if (path.startsWith("/mcp") || path.startsWith("/sse")) return "mcp";
  if (path.startsWith("/paid/") || path.startsWith("/v1/")) return "http";
  return "other";
}

/** Nombre de la tool: del path (/paid|/v1/<seg>) o del JSON-RPC de MCP (tools/call). */
export function toolFor(path: string, reqBody: string): string {
  const m = path.match(/^\/(?:paid|v1)\/([^/?]+)/);
  if (m) return m[1];
  if (reqBody) {
    try {
      const j = JSON.parse(reqBody);
      if (j?.method === "tools/call" && j?.params?.name) return String(j.params.name);
      if (j?.method) return String(j.method);
    } catch {
      /* body no-JSON */
    }
  }
  return "";
}

export interface TraceInput {
  ts: string;
  method: string;
  path: string;
  channel: string;
  tool: string;
  status: number;
  durationMs: number;
  ip: string;
  country: string;
  userAgent: string;
  wallet: string;
  paid: boolean;
  reqBody: string;
  respBody: string;
}

export async function writeTrace(env: Env, t: TraceInput): Promise<void> {
  const db = env.TRACES;
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT INTO traces
           (ts, method, path, channel, tool, status, duration_ms, ip, country, user_agent, wallet, paid, req_body, resp_body)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`,
      )
      .bind(
        t.ts, t.method, t.path, t.channel, t.tool, t.status, t.durationMs,
        t.ip, t.country, t.userAgent, t.wallet, t.paid ? 1 : 0, t.reqBody, t.respBody,
      )
      .run();
  } catch {
    /* las trazas nunca deben romper una petición */
  }
}
