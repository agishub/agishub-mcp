/**
 * /try — public page (no login) so a developer can try AgisHub in seconds:
 * runs a couple of FREE tools live (server-side) and explains the x402 flow +
 * how to install. It's a CONVERSION surface, separate from the private /console.
 * Only cheap/free catalog tools are exposed here.
 */
import type { Hono } from "hono";
import { resolveOperation } from "./services";
import { buildContext } from "./context";
import type { OperationContext } from "./services/types";

const DEMO: Record<string, { id: string; label: string; example: Record<string, unknown> }> = {
  now_in: { id: "timezone.now_in", label: "Current time in a timezone", example: { timezone: "Asia/Tokyo" } },
  convert_timezone: {
    id: "timezone.convert_timezone",
    label: "Convert between timezones",
    example: { datetime: "2026-08-10T15:00", from: "Europe/Madrid", to: "America/New_York" },
  },
  crypto_price: { id: "crypto.price", label: "Live crypto price (USD)", example: { symbols: "BTC,ETH,SOL" } },
  convert_currency: {
    id: "finance.convert_currency",
    label: "Currency conversion",
    example: { amount: 100, from: "USD", to: "EUR" },
  },
};

export function mountTry(app: Hono<{ Bindings: Env }>): void {
  // Public demo runner: only the allowlist above, free tools.
  app.post("/try/run", async (c) => {
    const def = DEMO[String(c.req.query("tool") || "")];
    if (!def) return c.json({ ok: false, error: "tool not allowed in the demo" }, 400);
    const op = resolveOperation(def.id);
    if (!op) return c.json({ ok: false, error: "operation unavailable" }, 500);
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

const TRY_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Try AgisHub · pay-per-call tools for AI agents</title>
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
<span class="tag">● live · no account · no API key</span>
<h1>Pay-per-call tools for AI agents</h1>
<p class="sub">Real data & utilities over <b>x402</b> (USDC on Base). Your agent pays a few cents per call from its own wallet. <b>Free over MCP</b>, paid over HTTP. Try it right here 👇</p>

<div class="card">
  <h2>▶ Try it now (free)</h2>
  <label>Tool</label>
  <select id="tool"></select>
  <label>Parameters (JSON)</label>
  <textarea id="args"></textarea>
  <button id="run">Run</button>
  <pre id="out" class="muted">The result will appear here…</pre>
</div>

<div class="grid2">
  <div class="card">
    <h2>🔌 Use it in your agent (free, MCP)</h2>
    <p class="muted">In Claude, Cursor, Windsurf or Claude Code:</p>
    <code class="cmd">claude mcp add agishub -- npx -y @agishub/mcp</code>
    <p class="muted">and all <b>30 tools</b> are ready to call.</p>
  </div>
  <div class="card">
    <h2>💳 Let your agent pay by itself (x402)</h2>
    <code class="cmd">npm install agishub-wallet</code>
    <pre>import { paidFetch } from "agishub-wallet";

// like fetch(), but auto-pays the 402
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
  out.className='muted';out.textContent='Running…';
  var body;try{body=JSON.parse(args.value||'{}');}catch(e){out.className='warn';out.textContent='Invalid JSON: '+e.message;return;}
  fetch('/try/run?tool='+encodeURIComponent(sel.value),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();})
    .then(function(j){out.className=j.ok?'ok':'warn';out.textContent=JSON.stringify(j.ok?j.result:j,null,2);})
    .catch(function(e){out.className='warn';out.textContent='Error: '+e;});
};
</script>
</div></body></html>`;
