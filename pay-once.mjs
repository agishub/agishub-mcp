/**
 * pay-once.mjs — hace UNA liquidación x402 real contra /paid/now-in ($0.001 USDC
 * en Base) para bootstrapear el listado en el bazaar de Coinbase (el catálogo solo
 * indexa un recurso tras el primer settle que lleve la metadata de discovery).
 *
 * El esquema `exact` firma una autorización EIP-3009 off-chain; el facilitador CDP
 * envía la tx y paga el gas → tu wallet pagadora solo necesita USDC (nada de ETH).
 *
 * Uso (la clave SOLO en tu terminal, nunca en el chat):
 *   cd ~/dev/agishub-mcp
 *   PAYER_PRIVATE_KEY=0xTU_CLAVE node pay-once.mjs
 *
 * Opcional: URL=https://timezone-toolkit.agishub.com/paid/now-in (si api.* falla)
 */
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const pk = process.env.PAYER_PRIVATE_KEY;
if (!pk) {
  console.error("❌ Falta PAYER_PRIVATE_KEY.\n   Uso: PAYER_PRIVATE_KEY=0x... node pay-once.mjs");
  process.exit(1);
}

const url = process.env.URL || "https://api.agishub.com/paid/now-in";
const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`));
console.log("Wallet pagadora:", account.address);
console.log("Pagando y llamando →", url, "\n");

const payFetch = wrapFetchWithPaymentFromConfig(
  (input, init) => fetch(input, init),
  { schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }] },
);

try {
  const r = await payFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ timezone: "Asia/Tokyo" }),
  });
  console.log("HTTP:", r.status);
  const receipt = r.headers.get("x-payment-response") || r.headers.get("payment-response");
  if (receipt) console.log("Comprobante (x-payment-response):", receipt);
  const body = await r.text();
  console.log("Respuesta:", body.slice(0, 600));
  if (r.status === 200) {
    console.log("\n✅ Liquidación COMPLETADA. Espera ~30-60s y vuelve a revisar el bazaar.");
  } else {
    console.log("\n⚠️ Status no-200: el settlement puede NO haberse completado. Mira el mensaje de arriba (¿fondos USDC? ¿402 sin firmar?).");
  }
} catch (e) {
  console.error("\n❌ Error al pagar:", e?.message || e);
  console.error("   Causas típicas: la wallet no tiene USDC en Base, o red intermitente (prueba URL=https://timezone-toolkit.agishub.com/paid/now-in).");
  process.exit(1);
}
