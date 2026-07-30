/**
 * Crypto spot prices via Coinbase's public API (no key, reliable from Cloudflare
 * Workers). Priced in USD, by ticker symbol (BTC, ETH, SOL…). Each symbol is
 * fetched independently so one bad symbol never fails the whole request.
 */
export async function price(symbols: string) {
  const list = symbols
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);
  if (list.length === 0) throw new Error("Provide one or more ticker symbols, e.g. 'BTC,ETH,SOL'.");

  const prices: Record<string, unknown> = {};
  await Promise.all(
    list.map(async (sym) => {
      try {
        const res = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, {
          signal: AbortSignal.timeout(6000),
          headers: { accept: "application/json" },
        });
        const j = (await res.json().catch(() => null)) as { data?: { amount?: string } } | null;
        if (res.ok && j?.data?.amount) prices[sym] = { price_usd: Number(j.data.amount) };
        else prices[sym] = { error: `no price for ${sym} (HTTP ${res.status})` };
      } catch {
        prices[sym] = { error: `could not fetch ${sym}` };
      }
    }),
  );
  return { vs_currency: "usd", prices, source: "coinbase", as_of: new Date().toISOString() };
}
