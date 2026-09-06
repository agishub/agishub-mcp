#!/usr/bin/env node
/**
 * Regenera las tablas de tools del README desde el catálogo, leído de
 * https://api.agishub.com/openapi.json.
 *
 * Estaban escritas a mano y arrastraban los nombres y precios anteriores a la
 * migración de taxonomía: anunciaban `now_in` a $0.001 cuando el endpoint es
 * `time.now` a $0.01. El README es además lo que npm publica como portada del
 * paquete, así que la desviación llegaba a los dos sitios.
 *
 * Sólo se reescribe el bloque entre "## Tools" y "## Quick start".
 *
 * Uso:  node scripts/generar-readme.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.agishub.com/openapi.json";

// Encabezado de cada sección, por categoría de mercado del catálogo.
const SECCIONES = [
  ["AI & Inference", "🤖 AI & Inference", "Language models, embeddings and classification — no external API key."],
  ["Search & Web", "🕸️ Search & Web", "Read, scrape, crawl and map any public page."],
  ["Data & Analytics", "📊 Data & Analytics", "Time, timezones, units and currency."],
  ["Market Data", "💱 Market Data", "Live crypto prices."],
  ["Media & Generation", "🖼️ Media & Generation", "Audio, images and documents."],
  ["Developer Tools", "🔧 Developer Tools", "QR codes, short links and guaranteed webhook delivery."],
  ["Knowledge & Memory", "🧠 Knowledge & Memory", "Persistent, semantically searchable memory."],
];

const doc = await (await fetch(API)).json();

const tools = Object.entries(doc.paths)
  .filter(([ruta]) => ruta.startsWith("/v1/"))
  .map(([ruta, m]) => {
    const p = m.post;
    return {
      nombre: `${p["x-service"]}.${p["x-tool"]}`,
      ruta: ruta.slice(4),
      categoria: p["x-category"] || "Developer Tools",
      precio: p["x-price"] || "",
      desc: String(p.summary || "").split(" (x402 paid")[0].trim(),
    };
  })
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

const precios = [...new Set(tools.map((t) => t.precio))].sort(
  (a, b) => Number(a.replace("$", "")) - Number(b.replace("$", "")),
);

let bloque = `## Tools

**${tools.length} tools across ${SECCIONES.filter((s) => tools.some((t) => t.categoria === s[0])).length} categories.** Prices are per call in USDC on Base, from ${precios[0]}.
Every tool is free to try over MCP; the HTTP endpoint is the one that charges.

`;

for (const [categoria, titulo, resumen] of SECCIONES) {
  const dentro = tools.filter((t) => t.categoria === categoria);
  if (!dentro.length) continue;
  bloque += `### ${titulo}\n\n${resumen}\n\n`;
  bloque += `| Tool | What it does | Endpoint | Cost |\n`;
  bloque += `|------|--------------|----------|:----:|\n`;
  for (const t of dentro) {
    const desc = t.desc.replace(/\|/g, "\\|");
    bloque += `| \`${t.nombre}\` | ${desc} | \`/v1/${t.ruta}\` | ${t.precio} |\n`;
  }
  bloque += `\n`;
}

let readme = readFileSync(join(RAIZ, "README.md"), "utf8");
const ini = readme.indexOf("## Tools");
const fin = readme.indexOf("## Quick start");
if (ini === -1 || fin === -1) {
  console.error("  No encuentro los límites de la sección Tools; no toco nada.");
  process.exit(1);
}
readme = readme.slice(0, ini) + bloque + readme.slice(fin);
writeFileSync(join(RAIZ, "README.md"), readme);

console.log(`  README: ${tools.length} tools escritas`);
console.log(`  niveles de precio: ${precios.join(" · ")}`);
