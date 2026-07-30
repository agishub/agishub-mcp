<div align="center">

# AgisHub

**Pay-per-call tools for AI agents — no signup, no API keys, just USDC.**

Live data & utilities over [x402](https://x402.org) micropayments on **Base**. Your agent
pays a few tenths of a cent per call from its own wallet; no accounts, no monthly plans.

![x402](https://img.shields.io/badge/x402-pay--per--call-6f42c1)
![Base](https://img.shields.io/badge/USDC-Base%20mainnet-0052ff)
![MCP](https://img.shields.io/badge/MCP-remote%20server-000000)
![License](https://img.shields.io/badge/license-MIT-green)

[Website](https://agishub.com) · [Live API](https://api.agishub.com) · [OpenAPI](https://api.agishub.com/openapi.json)

</div>

---

## Why AgisHub

Traditional APIs make an agent stop and ask a human: sign up, create an account, copy an
API key, add a credit card, read the docs. AgisHub tools are **callable the moment an agent
has a funded wallet** — the server answers `HTTP 402`, the agent signs a USDC payment on
Base, and the data flows back. Under a second, no human in the loop.

|                        | Raw API + key + plan | Single‑vendor MCP | **AgisHub** |
|------------------------|:--------------------:|:-----------------:|:-----------:|
| Sign‑up / API key      | required             | required          | **none**    |
| Billing                | monthly / credits    | subscription      | **per call (USDC)** |
| Agent can pay itself   | ✗                    | ✗                 | **✓ (x402)** |
| Free tier for discovery| varies               | varies            | **✓ (free MCP)** |
| Multiple tools, one door | ✗                  | one vendor        | **✓**       |

Free **MCP** tier to discover and prototype; pay‑per‑call **x402 HTTP** tier for production,
priced per request in USDC.

## Two doors, one platform

- **MCP (free)** — remote Model Context Protocol server. Point Claude / Cursor / any MCP
  client at the URL and the tools appear.
- **HTTP x402 (paid)** — `POST /v1/<tool>`; unpaid requests get a `402` challenge, the client
  signs a USDC payment (EIP‑3009 on Base) and retries. USDC contract `0x8335…2913`.

```
MCP (free):   https://api.agishub.com/mcp
HTTP (paid):  POST https://api.agishub.com/v1/<tool>
Discovery:    https://api.agishub.com/openapi.json
```

---

## Tools

**24 tools across 13 services.** Prices are per call in USDC on Base. Tools marked
**MCP · HTTP** are **free via MCP** and pay‑per‑call via **HTTP x402**; tools marked **HTTP**
are paid‑only (they touch metered infrastructure, so they run exclusively on the x402 endpoint).

### 🕔 Timezone — world clock, date math & scheduling

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `now_in` | Current local time in an IANA timezone — UTC offset, abbreviation, DST flag. | MCP · HTTP | $0.001 |
| `convert_timezone` | Convert a datetime between two IANA zones. Accepts ISO 8601 or natural language ("next Tuesday 3pm"). | MCP · HTTP | $0.001 |
| `convert_batch` | Convert one instant into many zones at once — ideal for world‑clock views. | MCP · HTTP | $0.001 |
| `tz_offset` | Exact UTC offset of a zone at a given instant (DST‑aware; handles +05:30, +05:45). | MCP · HTTP | $0.001 |
| `lookup_timezone` | Resolve a city or country to its IANA timezone(s). "Delhi" → `Asia/Kolkata`. | MCP · HTTP | $0.001 |
| `date_math` | Add/subtract time respecting DST, or diff two datetimes across zones. | MCP · HTTP | $0.001 |
| `find_meeting_slots` | Overlapping working‑hour slots across timezones (skips weekends & public holidays). | MCP · HTTP | free: 1 slot · **$0.02**: all |
| `is_holiday` | Is a date a public holiday in a country (ISO 3166‑1)? Data from Nager.Date. | MCP · HTTP | $0.001 |
| `list_timezones` | List or search valid IANA timezone names. | MCP | free |

### 🕸️ Web — read any web page as clean markdown

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `extract` | Fetch any public URL and return its main content as clean, token‑efficient markdown (title, headings, links, lists). Optional `render:true` runs a headless browser for JS‑heavy pages / SPAs. Built for RAG. | MCP · HTTP | **$0.004** |

### 🤖 AI — NLP & generation on Workers AI (no external API key)

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `summarize` | Summarize a block of text into a short abstract, with an optional target length. | MCP · HTTP | $0.003 |
| `classify` | Classify a text into exactly one of the candidate labels you provide. | MCP · HTTP | $0.002 |
| `extract_entities` | Extract named entities (people, orgs, locations, dates) as structured JSON. | MCP · HTTP | $0.003 |
| `embed` | Turn text into a multilingual embedding vector (BGE‑M3) for semantic search / RAG. | MCP · HTTP | $0.001 |
| `chat` | Ask a general‑purpose LLM a question, with an optional system prompt. | MCP · HTTP | $0.003 |
| `transcribe` | Transcribe an audio file (by public URL) to text with Whisper. | MCP · HTTP | $0.006 |
| `tts` | Convert text into spoken audio (base64 MP3), in several languages. | HTTP | $0.005 |

### 🧠 Memory / RAG — persistent semantic memory on Vectorize

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `memory_upsert` | Store text in a persistent, searchable collection (namespace); embedded & indexed. | MCP · HTTP | $0.001 |
| `memory_search` | Semantically search a namespace and return the most relevant stored entries. | MCP · HTTP | $0.001 |

### 📤 Webhooks — guaranteed, retried delivery

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `relay` | Deliver a webhook (POST/PUT/PATCH) with background retries. Returns a `job_id` at once. | MCP · HTTP | $0.002 |
| `status` | Check a webhook job's delivery status (queued / retrying / delivered / failed). | MCP · HTTP | $0.001 |

### 💱 Finance & crypto — live rates and prices

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `convert_currency` | Convert an amount between currencies using live daily FX rates (ISO 4217). | MCP · HTTP | $0.001 |
| `price` | Live USD spot prices for cryptocurrencies by ticker (BTC, ETH, SOL). Via Coinbase. | MCP · HTTP | $0.001 |

### 🔧 Utilities & links

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `qr_code` | Generate a QR code (inline SVG + data URI) for any text or URL. | MCP · HTTP | $0.001 |
| `convert_units` | Convert between units of one category (length, mass, volume, speed, area, storage, time, temperature). | MCP · HTTP | $0.001 |
| `shorten` | Shorten a long URL into a compact `api.agishub.com/s/<code>` redirect link. | MCP · HTTP | $0.001 |

### 🖼️ Render & browser — documents, images, automation (paid‑only)

| Tool | What it does | Channels | Cost (x402) |
|------|--------------|:--------:|:-----------:|
| `pdf` | Render a public URL or raw HTML into a PDF (base64). Headless Chromium. | HTTP | $0.008 |
| `screenshot` | Capture a PNG screenshot of any public URL (full page or viewport). | HTTP | $0.006 |
| `generate` (image) | Generate an image from a text prompt (base64 PNG). Backed by FLUX.1. | HTTP | $0.01 |
| `automate` (browser) | Drive a headless browser through steps — click, type, wait, extract, screenshot — for logins, forms and multi‑step flows. | HTTP | $0.01 |

> New services plug into the same MCP + x402 doors and appear automatically in
> [`/openapi.json`](https://api.agishub.com/openapi.json).

---

## Quick start

**Use the free MCP tools** (Claude Code example):

```bash
claude mcp add --transport http timezone https://api.agishub.com/mcp
```

**Pay per call over HTTP x402** (any x402 client / wallet):

```bash
# Unpaid → 402 challenge; an x402-aware client signs & retries automatically.
curl -X POST https://api.agishub.com/v1/web-scraper \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com","render":true}'
```

Your agent's wallet only needs **USDC on Base** — the facilitator covers gas.

## For agents & LLMs

- Payments are **real USDC on Base mainnet** and **irreversible**. Fund a dedicated agent
  wallet with a small balance; that balance is your spending cap.
- The free MCP tier never charges. Only the `/v1/*` (x402 HTTP) routes take payment.
- `extract` fetches arbitrary public URLs; it will not reach private/internal hosts.

## Pricing

Per‑call, in USDC on Base — no subscription. Roughly: **$1 ≈ 1,000 timezone calls**, **≈ 250
web extractions**, or **50 full meeting‑slot searches**. Settlement fees on Base are a fraction
of a cent and paid by the facilitator.

## License

MIT © AgisHub
