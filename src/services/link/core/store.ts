/**
 * URL shortener backed by the LINKS KV namespace. Codes use an unambiguous
 * alphabet (no 0/O/1/l). Entries expire after a year. The redirect route lives in
 * the Worker entrypoint (GET /s/:code).
 */

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const TTL_SECONDS = 60 * 60 * 24 * 365;

function genCode(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export async function shorten(env: Env | undefined, url: string, base: string) {
  const kv = env?.LINKS;
  if (!kv) throw new Error("URL shortener is not configured (missing LINKS KV namespace).");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http/https URLs are allowed.");

  let code = "";
  for (let i = 0; i < 5; i++) {
    code = genCode(6);
    if (!(await kv.get(code))) break;
  }
  await kv.put(code, u.toString(), { expirationTtl: TTL_SECONDS });
  return { code, short_url: `${base}/s/${code}`, url: u.toString(), expires_in_days: 365 };
}

export function resolve(env: Env | undefined, code: string): Promise<string | null> {
  const kv = env?.LINKS;
  if (!kv) return Promise.resolve(null);
  return kv.get(code);
}
