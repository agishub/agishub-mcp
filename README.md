<div align="center">

# AgisHub

**Pay-per-call tools for AI agents — no signup, no API keys, just USDC.**

### ▶ [Try any tool live in your browser — no install](https://api.agishub.com/try)

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

**34 tools across 7 categories.** Prices are per call in USDC on Base, from $0.01.
Every tool is free to try over MCP; the HTTP endpoint is the one that charges.

### 🤖 AI & Inference

Language models, embeddings and classification — no external API key.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `ai.chat` | Ask a general-purpose LLM a question or give it an instruction, with an optional system prompt. No external API key required. | `/v1/chat` | $0.02 |
| `ai.classify` | Classify a text into exactly one of the candidate labels you provide (e.g. sentiment, topic, intent). | `/v1/classify` | $0.02 |
| `ai.embed` | Turn text into a numeric embedding vector for semantic search, RAG and similarity. Multilingual. | `/v1/embed` | $0.01 |
| `ai.extract` | Extract named entities from text — people, organizations, locations, dates and miscellaneous — returned as structured JSON. | `/v1/extract` | $0.02 |
| `ai.summarize` | Summarize a block of text into a short abstract, with an optional target length. No external API key required. | `/v1/summarize` | $0.02 |

### 🕸️ Search & Web

Read, scrape, crawl and map any public page.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `web.browser` | Drive a headless browser: open a URL and run an ordered list of steps — click, type, press keys, wait, extract text and screenshot. For flows the plain scraper can't reach (logins, forms, multi-step pages). | `/v1/browser-automate` | $0.10 |
| `web.crawl` | Crawl multiple pages of a site, respecting link depth and domain limits. Returns async job_id; results include markdown or HTML per page. Use it to fetch and process many pages of content at once. | `/v1/crawl` | $0.10 |
| `web.extract` | Fetch any public web page and return its main content as clean, token-efficient Markdown (title, description, headings, links, lists). Set render:true to execute JavaScript first for single-page apps or JS-heavy pages that would otherwise come back empty. Built for RAG and for agents that need to read the contents of a URL. | `/v1/web-scraper` | $0.03 |
| `web.extract_structured` | AI-powered structured extraction: give a URL plus a natural-language prompt and/or a JSON Schema, and get back clean structured JSON (e.g. product name, price, rating). Renders the page in a headless browser first, so it works on SPAs. | `/v1/extract-structured` | $0.05 |
| `web.links` | Return every hyperlink on a JavaScript-rendered page as a list of absolute URLs, with options to keep only visible links or only same-site links. Backed by a headless browser. Use it to map a site or seed a crawler. | `/v1/links` | $0.03 |
| `web.map` | Discover all URLs reachable from a domain within a link depth limit. Returns a flat list of absolute URLs, respects robots.txt crawl delays. Use it to map a site's structure before crawling. | `/v1/crawl-map` | $0.05 |
| `web.scrape` | Extract specific elements from a JavaScript-rendered page by CSS selector. Give a list of selectors (e.g. 'h1', '.price', 'a.product') and get back the text and attributes of every match. Backed by a headless browser, so it works on SPAs and JS-heavy pages. | `/v1/scrape` | $0.03 |
| `web.screenshot` | Capture a PNG screenshot of any public URL — full page or just the viewport, at a chosen size — returned base64-encoded. Backed by a headless browser. | `/v1/screenshot` | $0.03 |
| `web.snapshot` | Capture several representations of a page in one call — rendered HTML plus a PNG screenshot by default, and optionally Markdown and the accessibility tree. Backed by a headless browser. Saves round-trips when an agent needs both the content and a visual of a page. | `/v1/snapshot` | $0.05 |

### 📊 Data & Analytics

Time, timezones, units and currency.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `data.convert_units` | Convert a value between units of the same category: length, mass, volume, speed, area, digital storage, time, and temperature (Celsius/Fahrenheit/Kelvin). | `/v1/units-convert` | $0.01 |
| `data.currency_convert` | Convert an amount between currencies using live daily exchange rates (ISO 4217 codes, e.g. USD, EUR, GBP, JPY). Returns the converted amount and the rate used. | `/v1/currency-convert` | $0.01 |
| `time.calculate` | Timezone-aware date arithmetic: add or subtract a duration to a datetime (days are calendar-based and DST-safe; hours and minutes are absolute), or compute the difference between two datetimes that may be in different zones. | `/v1/date-calculate` | $0.01 |
| `time.convert` | Convert a specific date/time from one IANA timezone to another (single or batch). Accepts ISO 8601 or natural language ('next Tuesday 3pm'). Returns the converted datetime with UTC offset, zone abbreviation and DST flag. | `/v1/time-convert` | $0.01 |
| `time.holiday` | Check whether a given date is a public holiday in a country (identified by its ISO 3166-1 alpha-2 code), and return the holiday name if so. Backed by an authoritative public-holiday dataset. | `/v1/time-holiday` | $0.01 |
| `time.meeting_slots` | Find working-hour time slots that overlap across participants in different timezones for a meeting of a given duration, excluding weekends and (when a country is given per participant) that person's public holidays. Free tier returns at most 1 slot; the paid endpoint returns every matching slot (see 'upgrade' in the response). | `/v1/meeting-slots` | $0.10 |
| `time.now` | Get the current local time in an IANA timezone, including the UTC offset, zone abbreviation and whether DST is in effect. Use whenever you need to know what time it is 'now' somewhere. | `/v1/time-now` | $0.01 |
| `time.offset` | Get the exact UTC offset of an IANA timezone at a given instant, DST-aware. Correctly handles fractional offsets such as India +05:30 and Nepal +05:45. | `/v1/time-offset` | $0.01 |
| `time.timezones` | List or search valid IANA timezone identifiers by city/region/country, and resolve a city/country name to its timezone(s). Use it to discover the exact identifier to pass to the other tools. | `/v1/timezones` | $0.01 |

### 💱 Market Data

Live crypto prices.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `market.crypto_price` | Get live USD spot prices for one or more cryptocurrencies by ticker symbol (e.g. BTC, ETH, SOL). | `/v1/crypto-price` | $0.01 |

### 🖼️ Media & Generation

Audio, images and documents.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `audio.speak` | Convert text into spoken audio (returned base64-encoded MP3), in several languages. | `/v1/audio-speak` | $0.05 |
| `audio.transcribe` | Transcribe an audio file (given by public URL) to text. Handles mp3, wav, m4a, ogg and more. | `/v1/audio-transcribe` | $0.05 |
| `document.pdf` | Render a public URL or a raw HTML string into a PDF document, returned base64-encoded. Backed by a headless browser. Use for invoices, reports, receipts and any HTML-to-PDF need. | `/v1/pdf` | $0.05 |
| `image.generate` | Generate an image from a text prompt (returned base64-encoded PNG). | `/v1/generate-image` | $0.10 |

### 🔧 Developer Tools

QR codes, short links and guaranteed webhook delivery.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `qr.generate` | Generate a QR code for any text or URL. Returns an inline SVG plus a data URI, with selectable size, quiet-zone margin and error-correction level. | `/v1/qr-generate` | $0.01 |
| `url.shorten` | Shorten a long URL into a compact api.agishub.com/s/<code> link that redirects to the original. Codes are stored for a year. | `/v1/shorten` | $0.01 |
| `webhook.send` | Deliver a webhook (POST/PUT/PATCH a JSON payload to a URL) with guaranteed, retried delivery. Returns immediately with a job_id; AgisHub keeps retrying in the background until it succeeds. | `/v1/webhook-send` | $0.02 |
| `webhook.status` | Check the delivery status of a webhook job (queued / retrying / delivered / failed) by its job_id. | `/v1/webhook-status` | $0.01 |

### 🧠 Knowledge & Memory

Persistent, semantically searchable memory.

| Tool | What it does | Endpoint | Cost |
|------|--------------|----------|:----:|
| `memory.search` | Semantically search a memory collection (namespace) and return the most relevant stored entries. The retrieval half of RAG. | `/v1/memory-search` | $0.01 |
| `memory.store` | Store a piece of text in a persistent, searchable memory collection (namespace). Embedded and indexed for later semantic recall. | `/v1/memory-store` | $0.01 |

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

Per‑call, in USDC on Base — no subscription, no signup, no API key. Five tiers, by what a
call actually costs to run:

| Tier | What | Examples |
|:----:|------|----------|
| **$0.01** | Lookups, conversions, memory | `time.now`, `data.currency_convert`, `memory.search` |
| **$0.02** | LLM inference, guaranteed delivery | `ai.chat`, `ai.classify`, `webhook.send` |
| **$0.03** | Browser, one page | `web.scrape`, `web.extract`, `web.screenshot` |
| **$0.05** | Heavy rendering, media | `web.snapshot`, `document.pdf`, `audio.transcribe` |
| **$0.10** | Orchestration, generation | `web.crawl`, `web.browser`, `image.generate` |

Roughly: **$1 ≈ 100 timezone calls**, **≈ 33 web extractions**, or **10 crawls of up to 100
pages each**. Settlement fees on Base are a fraction of a cent and paid by the facilitator.

`web.crawl` and `web.map` are capped per call (100 pages, 200 URLs) and priced flat, so a
larger site is several calls at the same rate rather than one unbounded charge.

## License

MIT © AgisHub
