/**
 * /try — página pública (sin login) para que un desarrollador pruebe AgisHub en
 * segundos: ejecuta en vivo un par de tools GRATIS (server-side) y explica el
 * flujo x402 + cómo instalarlo. Es una superficie de CONVERSIÓN, separada de la
 * consola privada /console. Solo se exponen tools baratas/gratuitas del catálogo.
 */
import type { Hono } from "hono";
import { resolveOperation } from "./services";
import { buildContext } from "./context";
import type { OperationContext } from "./services/types";

const DEMO: Record<string, { id: string; label: string; example: Record<string, unknown> }> = {
  now_in: { id: "timezone.now_in", label: "Hora actual en una zona", example: { timezone: "Asia/Tokyo" } },
  convert_timezone: {
    id: "timezone.convert_timezone",
    label: "Convertir entre zonas",
    example: { datetime: "2026-08-10T15:00", from: "Europe/Madrid", to: "America/New_York" },
  },
  crypto_price: { id: "crypto.price", label: "Precio cripto en vivo (USD)", example: { symbols: "BTC,ETH,SOL" } },
  convert_currency: {
    id: "finance.convert_currency",
    label: "Conversión de divisa",
    example: { amount: 100, from: "USD", to: "EUR" },
  },
};

export function mountTry(app: Hono<{ Bindings: Env }>): void {
  // Ejecutor de demo (público): solo el allowlist de arriba, tools gratis.
  app.post("/try/run", async (c) => {
    const def = DEMO[String(c.req.query("tool") || "")];
    if (!def) return c.json({ ok: false, error: "tool no permitida en la demo" }, 400);
    const op = resolveOperation(def.id);
    if (!op) return c.json({ ok: false, error: "operación no disponible" }, 500);
    const body = await c.req.json().catch(() => ({}) as unknown);
    try {
      const ctx = buildContext("http", {}, body, c.env) as OperationContext<any>;
      ctx.input = op.schema.parse(body);
      const result = await op.handler(ctx);
      return c.json({ ok: true, tool: def.id, result });
    } catch (e) {
      return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  app.get("/try", (c) => c.html(TRY_HTML.replace("%%DEMO%%", JSON.stringify(DEMO))));
}

const TRY_HTML = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prueba AgisHub · tools de pago-por-uso para agentes IA</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#0b0f17;color:#e6e9ef;font:15px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:40px 18px 80px}
h1{font-size:30px;margin:0 0 8px;font-weight:700;letter-spacing:-.02em}
.sub{color:#93a1b3;font-size:16px;margin:0 0 26px}
.tag{display:inline-block;background:#10263a;color:#7dd3fc;border-radius:999px;padding:3px 10px;font-size:12px;margin-bottom:14px}
.card{background:#0f1420;border:1px solid #1e293b;border-radius:12px;padding:18px;margin:16px 0}
h2{font-size:16px;margin:0 0 12px}
label{display:block;font-size:12px;color:#93a1b3;margin:10px 0 4px}
select,textarea{width:100%;background:#0b0f17;border:1px solid #334155;color:#e6e9ef;border-radius:8px;padding:9px 10px;font:13px ui-monospace,Menlo,monospace}
textarea{min-height:70px;resize:vertical}
button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;margin-top:12px}
button:hover{background:#1d4ed8}
pre{white-space:pre-wrap;word-break:break-word;background:#0b0f17;border:1px solid #1e293b;border-radius:8px;padding:12px;font:12px ui-monospace,Menlo,monospace;margin:12px 0 0;max-height:320px;overflow:auto}
code{background:#0b0f17;border:1px solid #1e293b;border-radius:6px;padding:2px 6px;font:12px ui-monospace,Menlo,monospace}
.cmd{display:block;background:#0b0f17;border:1px solid #334155;border-radius:8px;padding:10px 12px;font:13px ui-monospace,Menlo,monospace;margin:8px 0;overflow-x:auto}
.muted{color:#64748b;font-size:13px}
a{color:#7dd3fc}
.grid2{display:grid;gap:16px}@media(min-width:680px){.grid2{grid-template-columns:1fr 1fr}}
.ok{color:#22c55e}.warn{color:#f59e0b}
</style></head><body><div class="wrap">
<span class="tag">● en vivo · sin cuenta · sin API key</span>
<h1>Tools de pago-por-uso para agentes IA</h1>
<p class="sub">Datos y utilidades reales sobre <b>x402</b> (USDC en Base). Tu agente paga unos céntimos por llamada desde su propia wallet. <b>Gratis por MCP</b>, de pago por HTTP. Pruébalo aquí mismo 👇</p>

<div class="card">
  <h2>▶ Pruébalo ahora (gratis)</h2>
  <label>Tool</label>
  <select id="tool"></select>
  <label>Parámetros (JSON)</label>
  <textarea id="args"></textarea>
  <button id="run">Ejecutar</button>
  <pre id="out" class="muted">El resultado aparecerá aquí…</pre>
</div>

<div class="grid2">
  <div class="card">
    <h2>🔌 Úsalo en tu agente (gratis, MCP)</h2>
    <p class="muted">En Claude, Cursor, Windsurf o Claude Code:</p>
    <code class="cmd">claude mcp add agishub -- npx -y @agishub/mcp</code>
    <p class="muted">Y las <b>30 tools</b> aparecen listas para llamar.</p>
  </div>
  <div class="card">
    <h2>💳 Que tu agente pague solo (x402)</h2>
    <code class="cmd">npm install agishub-wallet</code>
    <pre>import { paidFetch } from "agishub-wallet";

// igual que fetch(), pero paga el 402 solo
await paidFetch("https://api.agishub.com/paid/now-in", {
  method: "POST",
  body: JSON.stringify({ timezone: "Asia/Tokyo" }),
});</pre>
  </div>
</div>

<p class="muted" style="margin-top:24px">
  Repos: <a href="https://github.com/agishub/agishub-mcp" target="_blank" rel="noreferrer">agishub-mcp</a> ·
  <a href="https://github.com/agishub/agishub-wallet" target="_blank" rel="noreferrer">agishub-wallet</a> ·
  npm <a href="https://www.npmjs.com/package/@agishub/mcp" target="_blank" rel="noreferrer">@agishub/mcp</a> ·
  <a href="https://www.npmjs.com/package/agishub-wallet" target="_blank" rel="noreferrer">agishub-wallet</a> ·
  <a href="/openapi.json">OpenAPI</a>
</p>

<script>
var DEMO=%%DEMO%%;
var sel=document.getElementById('tool'),args=document.getElementById('args'),out=document.getElementById('out');
Object.keys(DEMO).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=DEMO[k].label;sel.appendChild(o);});
function fill(){args.value=JSON.stringify(DEMO[sel.value].example,null,2);}
sel.onchange=fill;fill();
document.getElementById('run').onclick=function(){
  out.className='muted';out.textContent='Ejecutando…';
  var body;try{body=JSON.parse(args.value||'{}');}catch(e){out.className='warn';out.textContent='JSON inválido: '+e.message;return;}
  fetch('/try/run?tool='+encodeURIComponent(sel.value),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();})
    .then(function(j){out.className=j.ok?'ok':'warn';out.textContent=JSON.stringify(j.ok?j.result:j,null,2);})
    .catch(function(e){out.className='warn';out.textContent='Error: '+e;});
};
</script>
</div></body></html>`;
