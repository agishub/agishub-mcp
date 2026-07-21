/**
 * x402 v2 payment validator for timezone-toolkit.
 *
 * Pays the /paid/find-meeting-slots endpoint end-to-end:
 *   402 (PAYMENT-REQUIRED header) -> sign USDC authorization -> retry -> 200.
 *
 * Usage (from the project dir):
 *   NETWORK=base PRIVATE_KEY=0x<payer-key> node scripts/pay-test.mjs
 *
 * NETWORK=base -> Base mainnet (real USDC). Otherwise Base Sepolia testnet.
 * The payer wallet only needs USDC (no ETH — the facilitator pays gas).
 * Use the account that HOLDS the USDC (here: 0x448D…, not the receiver 0xF41…).
 */
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY to the PAYER account's private key (0x...).");
  console.error("Use the account that holds the USDC on Base (0x448D…), not the receiver.");
  process.exit(1);
}

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const network = process.env.NETWORK === "base" ? "eip155:8453" : "eip155:84532";
const url =
  process.env.URL || "https://timezone-toolkit.agishub.com/paid/find-meeting-slots";

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network, client: new ExactEvmScheme(account) }],
});

const body = JSON.stringify({
  participants: [{ timezone: "Europe/Madrid" }, { timezone: "America/New_York" }],
  duration: 60,
  date_range: { start: "2026-07-13", end: "2026-07-17" },
});

console.log("Payer address:", account.address);
console.log("Network:", network);
console.log("POST", url);

const res = await fetchWithPayment(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});
console.log("HTTP status:", res.status);

// Settlement receipt (v2 returns it in a response header).
for (const h of ["x-payment-response", "payment-response", "x-payment"]) {
  const v = res.headers.get(h);
  if (v) {
    try {
      const decoded = JSON.parse(Buffer.from(v, "base64").toString("utf8"));
      console.log("Settlement:", JSON.stringify(decoded));
      if (decoded?.transaction) {
        const base = network === "eip155:8453" ? "https://basescan.org" : "https://sepolia.basescan.org";
        console.log("On-chain tx:", `${base}/tx/${decoded.transaction}`);
      }
    } catch {
      console.log(`${h}:`, v.slice(0, 120));
    }
    break;
  }
}

const text = await res.text();
console.log("Result (truncated):", text.slice(0, 500));
console.log(res.ok ? "\n✅ PAID CALL SUCCEEDED — real x402 payment settled." : "\n❌ Call did not succeed.");
