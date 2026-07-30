/**
 * Live FX rates from open.er-api.com (free, no API key, updated daily). Rates are
 * cached per isolate for a few hours so bursts don't hammer the upstream.
 */

const cache: Record<string, { rates: Record<string, number>; date: string; ts: number }> = {};
const TTL_MS = 6 * 3600 * 1000;

async function getRates(base: string): Promise<{ rates: Record<string, number>; date: string }> {
  const b = base.toUpperCase();
  const hit = cache[b];
  if (hit && Date.now() - hit.ts < TTL_MS) return { rates: hit.rates, date: hit.date };
  const res = await fetch(`https://open.er-api.com/v6/latest/${b}`, { signal: AbortSignal.timeout(8000) });
  const j = (await res.json().catch(() => null)) as any;
  if (!res.ok || !j || j.result !== "success" || !j.rates) {
    throw new Error(`FX rates unavailable for base currency '${base}'. Use ISO 4217 codes like USD, EUR, GBP.`);
  }
  const date = j.time_last_update_utc || "";
  cache[b] = { rates: j.rates, date, ts: Date.now() };
  return { rates: j.rates, date };
}

export async function convertCurrency(amount: number, from: string, to: string) {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  const { rates, date } = await getRates(f);
  const rate = rates[t];
  if (rate == null) {
    throw new Error(`Unknown or unsupported currency: '${to}'. Use ISO 4217 codes like USD, EUR, GBP, JPY.`);
  }
  return { amount, from: f, to: t, rate, result: amount * rate, as_of: date, source: "open.er-api.com" };
}
