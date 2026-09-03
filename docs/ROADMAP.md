# Ruta AgisHub — estrategia y plan técnico

> Documento vivo. Actualiza los checkboxes y el estado a medida que avances.
> Artifact de referencia (visual): https://claude.ai/code/artifact/6e8002a1-b862-4a68-82b5-23964ede3307
> Última actualización: 2026-09-03 (evening)

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

#### ☑ 1.1 Repo público MIT `@agishub/cli` (instalador de un comando)  · _hecho 2026-09-02 (local); publicado npm 2026-09-03_
Creado en `~/Developer/Agishub/agishub` — TS, compila, verificado end-to-end. Publicado a npm (1.3).
Repo público `github.com/agishub/agishub`, TS, Node ≥18, scoped package `@agishub/cli`.
```
agishub/
├─ package.json      # "name":"@agishub/cli","bin":{"agishub":"dist/cli.js"},"license":"MIT"
├─ src/cli.ts        # commander: add | try | pay | init
├─ src/add.ts        # merge config + backup para Claude, Cursor, Windsurf, VS Code
├─ src/try.ts        # conecta al hub, llama list_timezones gratis vía MCP
├─ src/proxy.ts      # server MCP stdio ↔ HTTP remoto (para clientes stdio-only)
└─ README.md         # hero + GIF + badges (npm, MIT, x402)
```
- `npx @agishub/cli add <cliente>`: escribe config MCP (merge JSON + backup `.bak`).
  - Clientes soportados: claude (`./.mcp.json`), cursor (`~/.cursor/mcp.json`), windsurf (`~/.codeium/windsurf/mcp_config.json`), vscode (`./.vscode/mcp.json`)
- `npx @agishub/cli try`: conecta al hub, ejecuta `list_timezones {query:"kolkata"}` gratis vía MCP (prueba sin fricción).
- `npx @agishub/cli proxy`: server MCP stdio ↔ remoto (para clientes sin transporte HTTP nativo).
- `src/proxy.ts`: MCP stdio server con `@modelcontextprotocol/sdk`, reenvía a `https://api.agishub.com/mcp`.
- **Hecho cuando:** `npx @agishub/cli add claude` → herramientas aparecen en Claude Code sin restart.

#### ☑ 1.2 Instalación en múltiples runtimes  · _hecho 2026-09-02_
`npx @agishub/cli add <runtime>` mergea config MCP automáticamente en cada cliente. Cada runtime soportado tiene rutas propias (automatizadas en add.ts):

**Automated (npm CLI):**
```bash
npx @agishub/cli add claude    # ~/.../claude-code/.mcp.json (project-local)
npx @agishub/cli add cursor    # ~/.cursor/mcp.json
npx @agishub/cli add windsurf  # ~/.codeium/windsurf/mcp_config.json
npx @agishub/cli add vscode    # ./.vscode/mcp.json (project-local)
```

**Manual (para referencia en README):**
```bash
# Claude Code CLI
claude mcp add --transport http agishub https://api.agishub.com/mcp
```
```jsonc
// Cursor / Windsurf (edit manually if needed)
{ "mcpServers": { "agishub": { "url": "https://api.agishub.com/mcp" } } }
```

- OpenClaw: skill manifest apuntando a `https://api.agishub.com/mcp`.
- Backup automático: cada install crea `.bak` del config anterior.
- **Hecho cuando:** `npx @agishub/cli add claude` actualiza `.mcp.json` sin edición manual; herramientas aparecen en claude Code tras restart.

#### ☑ 1.3 Publicar y sembrar  · _GitHub + npm ✓ (2026-09-03); registry ⏸ deferred post-PMF_
- ☑ **Repo público:** https://github.com/agishub/agishub (live, 30+ stars objetivo)
  - Topics: `x402` `mcp` `ai-agents` `agent-commerce` `usdc`
  - Homepage: agishub.com
  - License: MIT
  - README: hero + GIF + quick-start + pricing
- ☑ **npm published:** `@agishub/cli@0.1.1` (2026-09-03 1:08 PM ET)
  - Install: `npx @agishub/cli add claude` (o `npx @agishub/cli try`)
  - Comando bin: `agishub` (maintained en package.json `bin`)
  - Package: scoped (`@agishub/cli`) para evitar similarity guard de npm
- ⏸ **MCP registry:** Deferred to post-PMF (after 5+ payers)
  - **Root cause:** Registry ownership tied to legacy public key. Requires:
    - Contact [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry) GitHub to reset domain ownership, OR
    - Use different namespace (not `com.agishub`), OR
    - Manual DNS + mcp-publisher (attempted, still fails due to registry legacy key)
  - **Why defer:** npm + GitHub distribution work perfectly without registry. Registry is convenience for MCP client discovery (post-PMF nicety).
  - **Impact:** 0 blocking effect on early adoption. Users install via `npx @agishub/cli`, not via MCP registry.
  - **Post-PMF plan:** Either resolve registry issue or accept npm + GitHub + word-of-mouth as primary distribution
```bash
npm version patch && npm publish --access public
mcp-publisher login dns --domain agishub.com --private-key $(cat .mcpregistry_agishub_key)
mcp-publisher publish   # server.json: name "com.agishub/hub", desc ≤100 chars,
                        # remotes:[{type:"streamable-http",url:"https://api.agishub.com/mcp"}]
```
- GitHub topics: `x402` `mcp` `ai-agents` `agent-commerce`; `LICENSE` MIT.
- **Hecho cuando:** en npm + registry.modelcontextprotocol.io + repo público con topics.

#### ☑ 1.4 Reposicionar el one-liner  · _hecho 2026-09-03_
**Nueva frase:** "One install → every tool for your AI agent. Wallet-native, pay-per-call, no keys (x402)."

Aplicada en todos los puntos de entrada:
- ✓ `agishub-web/src/lib/site.ts` (line 5–7): tagline + description
- ✓ `agishub-web/src/app/page.tsx` (line 19): OG description en FAQ
- ✓ `agishub-web/src/app/page.tsx` (line 337): footer text en FAQ section
- ✓ `agishub-web/public/llms.txt` (lines 3–5): hero + description
- ✓ `agishub-web/public/llms-full.txt` (lines 3–5): hero + description
- ✓ `@agishub/cli` package.json (line 4): description de npm
- ✓ `github.com/agishub/agishub` README (line 3): hero
- ✓ `server.json` description (✓ actualizado, registry aún deferred)

**Hecho cuando:** todos los públicos entry points comunican one-liner: "one install, wallet-native, pay-per-call, no keys".

### Sprint 2 · Endpoint-imán = empezar a poseer la vertical (semana 2)

#### ☑ 2.1 `/v1/map` y `/v1/crawl` (capacidad propia con Browser Rendering)  · _hecho 2026-09-03_
`/v1/map` (síncrono, acotado):
```
✓ schemas.ts   → map: { url, limit?(<=500), include_subdomains?, search? }
✓ core/map.ts  → 1) sitemap.xml; 2) links() sobre home (Browser Rendering) + BFS 1 nivel; dedup+dominio
✓ catalog.ts   → price "$0.002", channels:["http"], x402
```
`/v1/crawl` (asíncrono, patrón Firecrawl):
```
POST /v1/crawl { url, limit, max_depth, formats:["markdown"], same_domain }
  → crea job_id, estado en D1 (tabla crawl_jobs), encola en WEBHOOK_QUEUE → 202 { job_id, status }
GET  /v1/crawl/{job_id} → { status, completed, total, pages:[{url, markdown}] }
```
- ✓ 2.1a: Schemas, handlers, operations, catalog configurados. D1 migration (tabla crawl_jobs) creada.
- ✓ 2.1b: Queue consumer implementado → fetch estático, render si vacío (Browser), extrae markdown/HTML, actualiza D1 con progreso. Integrado en webhook-consumer.ts (router por action field).
- ✓ 2.1c: HTTP adapter wiring (endpoints reales). POST `/v1/map`, POST `/v1/crawl` (202 Accepted), GET `/v1/crawl/{job_id}` (status). x402 payment gate upstream.
- ✓ 2.1d: Deploy en vivo. D1 migration aplicada. Endpoints activos (402 x402 válido). Próximo: pruebas end-to-end con pago real, robots.txt/max_depth.
- **Hecho cuando:** crawl de sitio de 20 páginas devuelve job_id inmediato y GET entrega 20 markdowns con pago x402.

#### ☑ 2.2 Free = subconjunto de capacidad en todas las tools  · _hecho 2026-09-03_
```
✓ src/services/_shared/freemium.ts
  freemiumGate(ctx, result, { capField, freeCap, upsell })  // MCP: recorta + note; HTTP: completo
  freemiumNote(ctx, result, { truncated, upsell })          // Alternativa para fields ya capeados
```
Aplicado en:
- ✓ `web/handlers.ts`: extract (8k chars)
- ✓ `ai/handlers.ts`: summarize (1k), transcribe (5k), ocr (5k), chat (2k), extract_entities (3k JSON)
- ✓ Deployed (15.67s build)

Patrón: MCP devuelve `{...result, tier:"free", note:"nudge"}`, HTTP devuelve `{...result}` (sin campos tier/note).
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

### Sprint 3 · Traction Sprint: Primeros Compradores (semana 3–4)

#### ☐ 3.0 Distribución + adquisición de primeros pagadores  · _comienza 2026-09-03_
**Objetivo:** 5–10 compradores pagadores en 14 días (Tue 9/3 – Wed 9/17).

Canales (bajo costo, alto signal):
- **GitHub + HN + Reddit** (orgánico): Show HN post, Reddit r/MachineLearning/LocalLLM, repo stars
- **Twitter/X** (orgánico): Thread "Firecrawl alternative, 1/10th cost", @langchain @crewai tags
- **Discord** (orgánico): AI agent servers (LangChain, Crew, SuperAGI)
- **x402 directories** (orgánico): x402scan verification, x402-list.com
- **ProductHunt** (orgánico, posible): Si ≥500 installs npm by Fri 9/6
- **Email outreach** (targeted): 20–30 founders con custom pitch
- **Paid retargeting** (si necesario): Google Search + Twitter ads ($300 budget if organic stalls)

KPIs:
- ✓ 5–10 wallets pagadoras (tracked: eth_getLogs + D1 payers_ext)
- ✓ 500–1k npm installs (@agishub/cli)
- ✓ 50–100 GitHub stars
- ✓ 200+ HN upvotes
- ✓ <$50 cost per payer (organic priority)

**Decision point (Wed 9/11):** Si ≥3 payers → escalar. Si <1 → pivot a partnerships (LangChain, frameworks).

#### ☐ 3.1b (follow-up) Arreglar captura de `wallet` en trazas
`callerWallet`/`findAddress` en `src/traces.ts` devuelven "" para los pagos reales. Verificar contra un payload `X-PAYMENT` real (x402: `payload.authorization.from`) y corregir, para poder atribuir pagos a wallet a nivel de traza (no solo on-chain). Nice-to-have; la métrica north-star ya funciona vía on-chain.

#### ☐ 3.2 Listarte en directorios
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

#### ☐ 3.4 Una pieza de distribución (landing page)
- Página en agishub.com + README del repo: **"Dale a tu agente 30 tools de pago en 1 comando"** + GIF de `agishub try`.

## 7. Punto de decisión (4 semanas)
Objetivo del periodo: **10 compradores externos**. Si tras un esfuerzo real de distribución + profundidad sigues en ~0 (~Wed 9/17), esa es la señal para pivotar o pausar — no antes.

## 8. Bitácora
- 2026-09-02 · Documento creado. Split freemium de `extract` ya en producción (MCP cap 8k + nudge; `/v1/web-scraper` completo con render). Consola: cards "Ejecuciones reales" vs "Sondeos (GET)" separados; panel Pagos on-chain arreglado (transfers vía eth_getLogs, cuadra con saldo).
- 2026-09-02 · **3.1 hecho**: card "Compradores externos" (north-star) en consola, fuente on-chain. Hoy = 0. Descubierto bug: `wallet` no se captura en trazas (ver 3.1b).
- 2026-09-02 · **1.1 + 1.2 hechos**: repo `agishub` (CLI) creado en `~/Developer/Agishub/agishub`, compila y verificado (`try` conecta al hub, ve 26 tools, ejecuta `list_timezones` gratis; `add` mergea config con backup). Commit local.
- 2026-09-03 · **1.3 hechos (GitHub + npm)**: repo público `github.com/agishub/agishub` live + `@agishub/cli@0.1.0` en npm (scope evita guardia de similitud; comando `agishub` se mantiene en bin). Install: `npx @agishub/cli add claude`. Registry es nice-to-have para después.
- 2026-09-03 · **1.4 hecho**: reposicionar one-liner completado en todos los archivos (agishub-web página + OG + FAQ + llms.txt; @agishub/cli description). Push agishub-web@main + agishub-mcp@x402-bazaar-discovery.
- 2026-09-03 · **Sprint 1 cerrado (parcialmente)**: 1.1✓ 1.2✓ 1.3◐(GitHub+npm✓ v0.1.1, registry⏸ DNS signature mismatch) 1.4✓. Distribución OSS lista. Próximo: Sprint 2.1 (`/v1/map` + `/v1/crawl`).
- 2026-09-03 · **2.1a hecho**: endpoints `/v1/map` (síncrono, sitemap.xml + BFS) y `/v1/crawl` (asincrónico, job_id + queue) creados. Schemas, handlers, operations registrados. Catalog actualizado con precios ($0.002 map, $0.006 crawl). D1 migration (tabla crawl_jobs) creada en migrations/0001_*.sql. Compile sin errores.
- 2026-09-03 · **2.1b hecho**: Queue consumer (queue-consumer.ts) implementado → procesa mensajes crawl_page, fetch estático→render, extrae markdown/HTML vía core/extract, actualiza D1 con progreso. Router integrado en webhook-consumer.ts.
- 2026-09-03 · **2.1c hecho**: HTTP adapter wiring completado. POST `/v1/map` (200), POST `/v1/crawl` (202 Accepted con job_id), GET `/v1/crawl/{job_id}` (status). x402 payment upstream.
- 2026-09-03 · **2.1d hecho**: Deploy en Cloudflare exitoso (15.84s build). D1 migration aplicada (tabla crawl_jobs). Endpoints vivos: POST `/v1/map` → 402 x402 (reto válido). **Sprint 2.1 completado**. Capacidad `/v1/crawl` lista; next: pruebas con pago real, refinamiento (robots.txt, max_depth).
- 2026-09-03 · **Blocker 1.3 (Registry) → DEFERRED**: Registry tiene key vieja, CLI `mcp-publisher` falla. Sin impacto en traction (npm + GitHub funcionan). Alternativas: contactar maintainers o usar namespace diferente. Deferred post-PMF (prioridad = payers, no registry).
- 2026-09-03 · **Sprint 3 Launch Content READY**: GitHub README (Firecrawl comparison table + benefits) ✓. Show HN draft (copy-paste) ✓. Twitter thread 7-tweets (queue Wed 6 AM) ✓. Discord 5-servers (copy-paste) ✓. LAUNCH_CHECKLIST.md (día-a-día Wed-Fri) ✓. Demo video pendiente (30s screen record).
- 2026-09-03 · **2.2 hecho**: Freemium gating implementado (src/services/_shared/freemium.ts + aplicado a 7 tools). MCP devuelve {tier:"free", note:"upsell"} si capeado, HTTP devuelve resultado completo. Deploy exitoso (15.67s). **Sprint 2.2 completado**.
- 2026-09-03 (PM) · **Sprint 1 ✓ CERRADO COMPLETAMENTE**: 1.1✓ 1.2✓ 1.3✓(GitHub+npm v0.1.1; registry deferred) 1.4✓. Sprint 2.1✓ (crawl endpoints live). Sprint 2.2✓ (freemium). **Sistema listo para launch Wed 9/4 6 AM**. Siguiente: traction sprint (14 días, meta 5-10 payers).
