/**
 * Smoke-test any paid x402 endpoint with your Base wallet, and save binary
 * results (PDF / PNG) to a file so you can open them.
 *
 * Usage (from the project dir):
 *   NETWORK=base PRIVATE_KEY=0x<payer-key> node scripts/pay-any.mjs <path> '<json-body>'
 *
 * Examples:
 *   ... node scripts/pay-any.mjs /paid/pdf            '{"url":"https://example.com"}'
 *   ... node scripts/pay-any.mjs /paid/screenshot     '{"url":"https://agishub.com","full_page":true}'
 *   ... node scripts/pay-any.mjs /paid/generate-image '{"prompt":"a neon fox, isometric"}'
 *
 * The payer wallet only needs USDC on Base (the facilitator pays gas).
 */
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { writeFileSync } from "node:fs";

const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY to the PAYER wallet's private key (0x...). It needs USDC on Base.");
  process.exit(1);
}
const path = process.argv[2] || "/paid/pdf";
const body = process.argv[3] || "{}";
const base = process.env.BASE || "https://api.agishub.com";
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const network = process.env.NETWORK === "base" ? "eip155:8453" : "eip155:84532";

const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network, client: new ExactEvmScheme(account) }],
});

console.log("Payer:", account.address, "→", base + path);
const res = await pay(base + path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});
console.log("HTTP", res.status);

const receipt = res.headers.get("x-payment-response") || res.headers.get("payment-response");
if (receipt) {
  try {
    const d = JSON.parse(Buffer.from(receipt, "base64").toString("utf8"));
    if (d?.transaction) console.log("on-chain tx:", `https://basescan.org/tx/${d.transaction}`);
  } catch {}
}

const json = await res.json().catch(() => null);
if (json && (json.base64 || json.data_uri)) {
  const b64 = json.base64 || String(json.data_uri).split(",")[1];
  const ext = json.mime?.includes("pdf") ? "pdf" : json.format || "bin";
  const file = `out.${ext}`;
  writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(`✅ saved ${json.bytes ?? Buffer.from(b64, "base64").length} bytes -> ${file}`);
} else {
  console.log(JSON.stringify(json).slice(0, 500));
}
