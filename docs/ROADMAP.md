# Ruta AgisHub — estrategia y plan técnico

> Documento vivo. Actualiza los checkboxes y el estado a medida que avances.
> Artifact de referencia (visual): https://claude.ai/code/artifact/6e8002a1-b862-4a68-82b5-23964ede3307
> Última actualización: 2026-09-02

Leyenda estado: ☐ pendiente · ◐ en curso · ☑ hecho · ⏸ bloqueado

---

## 1. Situación (sin adornos)

| Dato | Valor |
|---|---|
| Endpoints de pago en vivo | ~30 |
| **Compradores externos reales** | **0** |
| Tráfico real 24h | 159 ejecuciones vs 2.021 sondeos de bots |
| Deadline de tracción | vencido (~26 ago 2026) |

La tecnología funciona (pagos liquidan on-chain, hub responde). El problema es **demanda**.

## 2. Sigue el dinero (cifras anuales)

| | Modelo | Anual |
|---|---|---|
| **Firecrawl** | **posee la capacidad** (crawl/anti-bot) + marca + $14,5M levantados | **~$1.500.000** |
| BlockRun | rail + distribución OSS | ~$240.000 |
| StableEnrich | revende sin nada propio | ~$22.200 |

**Regla:** el dinero está en **poseer capacidad**, no en el rail ni en revender (poseer = 68× revender).
Matiz: el $1,5M de Firecrawl es **suscripción de devs**, no micropagos x402. El techo del x402 puro hoy ≈ BlockRun.

## 3. Decisión: A → B (secuencia, no disyuntiva)

- **Rampa (semanas):** distribución OSS de un comando en los runtimes → trae los primeros compradores.
- **Destino (meses):** poseer una vertical profunda (**datos web**) hasta tener `crawl`/`map` con fiabilidad propia.
- **Ángulo único:** *calidad-Firecrawl pero wallet-native* (sin key, sin suscripción) → captar a los agentes que Firecrawl no sirve.
- **A evitar:** quedarse en revendedor thin (~$22k/año, clonable). Reventa solo como puente.

---

## 4. Plan técnico

Stack: Worker Hono `timezone-toolkit` / api.agishub.com · `src/services/<svc>/{schemas,handlers,operations,index}.ts` → `catalog.ts` → `adapters/http.ts` → `billing/x402.ts` · Browser Rendering (`BROWSER`) · D1 `agishub-traces` · KV · MCP en `/mcp` · consola `src/private/backoffice.ts` (skip-worktree).

### Sprint 1 · La cuña de distribución (semana 1)

#### ☑ 1.1 Repo público MIT `agishub` (instalador de un comando)  · _hecho 2026-09-02 (local, sin publicar)_
Creado en `~/Developer/Agishub/agishub` — TS, compila, verificado end-to-end. Falta publicar (1.3).
Nuevo repo `github.com/agishub/agishub`, TS, Node ≥18.
```
agishub/
├─ package.json      # "name":"agishub","bin":{"agishub":"dist/cli.js"},"license":"MIT"
├─ src/cli.ts        # commander: add | try | pay | init
├─ src/proxy.ts      # (recom.) MCP stdio ↔ HTTP remoto (aparece "instalado en local")
└─ README.md         # hero + GIF + badges (npm, MIT, stars)
```
- `agishub add <cliente>`: escribe config MCP del cliente (merge JSON + backup `.bak`).
- `agishub try`: llama una tool **gratis** vía `/mcp` (fricción cero).
- `agishub pay`: envuelve x402 reutilizando el paquete `agishub-wallet` existente.
- `src/proxy.ts`: server MCP **stdio** con `@modelcontextprotocol/sdk` que reenvía a `https://api.agishub.com/mcp`.
- **Hecho cuando:** `npx agishub add claude` → las tools aparecen en Claude Code.

#### ☑ 1.2 Install de un comando por runtime  · _hecho 2026-09-02_
`agishub add claude|cursor|windsurf|vscode` mergea la config MCP con backup. Rutas manuales en README.
```bash
# Claude Code
claude mcp add --transport http agishub https://api.agishub.com/mcp
```
```jsonc
// Cursor ~/.cursor/mcp.json · Windsurf ~/.codeium/windsurf/mcp_config.json
{ "mcpServers": { "agishub": { "url": "https://api.agishub.com/mcp" } } }
```
- OpenClaw: manifest de skill apuntando al mismo URL.
- **Hecho cuando:** Claude/Cursor/OpenClaw funcionan desde el README sin editar a mano.

#### ◐ 1.3 Publicar y sembrar  · _GitHub + npm ✓ (2026-09-03); registry ⏸ DNS signature mismatch_
- ☑ Repo público: https://github.com/agishub/agishub (topics: x402, mcp, ai-agents, agent-commerce, usdc; homepage agishub.com).
- ☑ npm: `@agishub/cli@0.1.1` publicado. Install: `npx @agishub/cli add claude` (comando `agishub` se mantiene en bin).
- ⏸ MCP registry: `mcp-publisher login dns` falla con "signature verification failed (tried published key ed25519:Yxv3Jp0+)". DNS record requiere verificación/actualización. **Nice-to-have para después de compradores reales**; no bloquea Sprint 2.
```bash
npm version patch && npm publish --access public
mcp-publisher login dns --domain agishub.com --private-key $(cat .mcpregistry_agishub_key)
mcp-publisher publish   # server.json: name "com.agishub/hub", desc ≤100 chars,
                        # remotes:[{type:"streamable-http",url:"https://api.agishub.com/mcp"}]
```
- GitHub topics: `x402` `mcp` `ai-agents` `agent-commerce`; `LICENSE` MIT.
- **Hecho cuando:** en npm + registry.modelcontextprotocol.io + repo público con topics.

#### ☑ 1.4 Reposicionar el one-liner  · _hecho 2026-09-03_
Nueva frase: **"One install → every tool for your AI agent. Wallet-native, pay-per-call, no keys (x402)."**
Archivos: `agishub-web` (hero + meta description + OG + FAQ), `public/llms.txt` + `llms-full.txt`, descripción npm (@agishub/cli), `desc` del server.json. ✓ Completado.

### Sprint 2 · Endpoint-imán = empezar a poseer la vertical (semana 2)

#### ◐ 2.1 `/v1/map` y `/v1/crawl` (capacidad propia con Browser Rendering)  · _esqueleto 2026-09-03_
`/v1/map` (síncrono, acotado):
```
schemas.ts   → map: { url, limit?(<=500), include_subdomains?, search? }
core/map.ts  → 1) sitemap.xml; 2) links() sobre home (Browser Rendering) + BFS 1 nivel; dedup+dominio
catalog.ts   → price "$0.002", channels:["http"], x402
adapters/http.ts → POST /v1/map
```
`/v1/crawl` (asíncrono, patrón Firecrawl):
```
POST /v1/crawl { url, limit, max_depth, formats:["markdown"], same_domain }
  → crea job_id, estado en D1 (tabla crawl_jobs), encola en WEBHOOK_QUEUE → 202 { job_id, status }
GET  /v1/crawl/{job_id} → { status, completed, total, pages:[{url, markdown}] }
```
- Consumer de la Queue: `fetch` estático primero, `render` solo si vacío (coste), extrae a markdown (`core/extract`), páginas → **R2** (añadir binding), progreso → D1. Respeta robots.txt, max_depth, limit, mismo dominio, concurrencia 3–5.
- Límite CF: Browser Rendering tiene tope de concurrencia/tiempo → trocear por Queue; para crawls grandes evaluar **Cloudflare Workflows**.
- Reventa upstream anti-bot = solo fallback para webs blindadas.
- **Hecho cuando:** crawl de sitio de 20 páginas devuelve job y el GET entrega 20 markdowns con pago x402.

#### ☐ 2.2 Free = subconjunto de capacidad en todas las tools
```
src/services/_shared/freemium.ts
  freemiumGate(ctx, result, { capField, freeCap, upsell })  // MCP: recorta + note; HTTP: completo
```
Aplicar en `handlers.ts` de web/render/ai (generaliza el patrón ya hecho en `extract`).
- **Hecho cuando:** toda tool cara en MCP devuelve `tier:"free"` + nudge, completa en `/v1`.

#### ☐ 2.3 Dos carriles de cobro (x402 + prepago wallet-native)
```
POST /v1/credits/topup → pago x402 grande acredita saldo en D1 (credits:{wallet,balance})
Middleware adapters/http.ts: firma de wallet con saldo>0 → descuenta y ejecuta SIN reto 402; si no → x402 normal
```
- Heavy user paga una vez, luego llama sin firmar cada vez (equivalente a suscripción, en USDC).
- Fiat/Stripe = fase 2 opcional, acredita el mismo saldo.
- **Hecho cuando:** un wallet con prepago llama 100 veces con una sola firma inicial.

### Sprint 3 · Probar demanda + capa de control (semanas 3–4)

#### ☑ 3.1 North-star: wallets pagadoras externas distintas  · _hecho 2026-09-02_
Card destacado "Compradores externos" en la consola (hoy **0**, objetivo 10).
- **Fuente:** on-chain (`/health/payments`, `eth_getLogs`), NO la columna `wallet` de trazas.
- **Motivo:** se descubrió que `callerWallet` (traces.ts) **no rellena `wallet` en ninguna traza** (0 en todo el histórico) — no extrae la dirección de la cabecera `X-PAYMENT`. Por eso se usa el `from` on-chain, que es fiable. `payers_ext` excluye `OWN_WALLETS` (0x448d…, pagador de test) y el propio payTo.

#### ☐ 3.1b (follow-up) Arreglar captura de `wallet` en trazas
`callerWallet`/`findAddress` en `src/traces.ts` devuelven "" para los pagos reales. Verificar contra un payload `X-PAYMENT` real (x402: `payload.authorization.from`) y corregir, para poder atribuir pagos a wallet a nivel de traza (no solo on-chain). Nice-to-have; la métrica north-star ya funciona vía on-chain.

#### ☐ 3.2 Listarte en directorios  · _(alta = usuario)_
- x402scan "Add your API": verificar que los `/v1/*` devuelven reto **402 x402 bien formado** (`accepts`, precio, network, asset) para que el scanner indexe; luego formulario.
- x402-list.com + MCP registry (ver 1.3). Verificar `openapi.json` con `/v1/map` y `/v1/crawl`.
- **Hecho cuando:** AgisHub aparece en x402scan con endpoints y precios.

#### ☐ 3.3 Vista de control por cliente (caps + audit) — semilla del moat
```
Ruta /me (auth: wallet firma nonce → viem verifyMessage)
  read-only: llamadas, gasto, últimas tx (filtrando TRACES por wallet)
Cap: KV { wallet → daily_cap_usd }; enforcement en billing/x402.ts (suma gasto de hoy vs cap → deniega)
```
- **Hecho cuando:** un comprador ve su consumo firmando y fija un tope diario que el Worker respeta.

#### ☐ 3.4 Una pieza de distribución
- Página en agishub.com + README del repo: **"Dale a tu agente 30 tools de pago en 1 comando"** + GIF de `agishub try`.

---

## 5. Dependencias y orden
- 1.1 → 1.2 → 1.3 → 1.4 en serie (repo primero).
- 2.1 necesita binding **R2** en `wrangler.jsonc` + tabla `crawl_jobs` (D1 migrations).
- 2.3 necesita tabla `credits` (D1).
- 3.1 es solo consola → hazlo ya para medir desde el día 1.

## 6. Reparto
- **Claude (código/textos):** 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 3.3.
- **Usuario (credenciales/decisiones):** 1.3 (`npm publish` + registry + 2FA), 3.2 (alta x402scan), binding R2 y coste Browser Rendering para crawl.

## 7. Punto de decisión (4 semanas)
Objetivo del periodo: **10 compradores externos**. Si tras un esfuerzo real de distribución + profundidad sigues en ~0, esa es la señal para pivotar o pausar — no antes.

## 8. Bitácora
- 2026-09-02 · Documento creado. Split freemium de `extract` ya en producción (MCP cap 8k + nudge; `/v1/web-scraper` completo con render). Consola: cards "Ejecuciones reales" vs "Sondeos (GET)" separados; panel Pagos on-chain arreglado (transfers vía eth_getLogs, cuadra con saldo).
- 2026-09-02 · **3.1 hecho**: card "Compradores externos" (north-star) en consola, fuente on-chain. Hoy = 0. Descubierto bug: `wallet` no se captura en trazas (ver 3.1b).
- 2026-09-02 · **1.1 + 1.2 hechos**: repo `agishub` (CLI) creado en `~/Developer/Agishub/agishub`, compila y verificado (`try` conecta al hub, ve 26 tools, ejecuta `list_timezones` gratis; `add` mergea config con backup). Commit local.
- 2026-09-03 · **1.3 hechos (GitHub + npm)**: repo público `github.com/agishub/agishub` live + `@agishub/cli@0.1.0` en npm (scope evita guardia de similitud; comando `agishub` se mantiene en bin). Install: `npx @agishub/cli add claude`. Registry es nice-to-have para después.
- 2026-09-03 · **1.4 hecho**: reposicionar one-liner completado en todos los archivos (agishub-web página + OG + FAQ + llms.txt; @agishub/cli description). Push agishub-web@main + agishub-mcp@x402-bazaar-discovery.
- 2026-09-03 · **Sprint 1 cerrado (parcialmente)**: 1.1✓ 1.2✓ 1.3◐(GitHub+npm✓ v0.1.1, registry⏸ DNS signature mismatch) 1.4✓. Distribución OSS lista. Próximo: Sprint 2.1 (`/v1/map` + `/v1/crawl`).
- 2026-09-03 · **2.1 inicio (esqueleto)**: endpoints `/v1/map` (síncrono, sitemap.xml + BFS) y `/v1/crawl` (asincrónico, job_id + queue) creados. Schemas, handlers, operations registrados. Catalog actualizado con precios ($0.002 map, $0.006 crawl). Compile sin errores. Pendiente: D1 migration (tabla crawl_jobs), completar core logic (queue consumer, extraction).
