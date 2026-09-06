/**
 * Catalog — publication + commercialization, kept separate from Operations.
 * Phase 3: Reorganized by 7 market-first categories, consolidated namespaces.
 * OperationIds changed to align with new service structure (e.g., timezone→time, crypto→market).
 */

export type Channel = "mcp" | "http";

export interface CatalogEntry {
  channels: Channel[];
  pricing?: { x402?: string };
  visibility: "public" | "private";
  description: string;
  examples?: unknown[];
  tags?: string[];
  /** HTTP path segment for /v1/<httpPath> and /paid/<httpPath>. */
  httpPath?: string;
  /**
   * MCP tool name, when it must differ from the operation name. MCP exposes one
   * flat namespace, so two services sharing an operation name silently collide
   * and only one survives in tools/list — set this on the newcomer to keep both
   * reachable. Defaults to the operation name.
   */
  mcpName?: string;
  /** Market-oriented category (7 categories for discovery). */
  category?: "AI & Inference" | "Search & Web" | "Data & Analytics" | "Market Data" | "Media & Generation" | "Developer Tools" | "Knowledge & Memory";
  /** Operation type (verb: Fetch, Extract, Analyze, etc.). */
  operation?: "Search" | "Fetch" | "Discover" | "Extract" | "Analyze" | "Transform" | "Generate" | "Retrieve" | "Store" | "Compute" | "Connect" | "Act";
  /** Use cases for semantic discovery. */
  use_cases?: string[];
}

export type Catalog = Record<string, Record<string, CatalogEntry>>;

// Suelo del catálogo. Subido de $0.001 a $0.01: a la escala anterior un cobro
// real quedaba por debajo del ruido y no se distinguía en el panel de pagos.
const COMMODITY = "$0.01";

export const catalog: Catalog = {
  // ─────────────────────────────────────────────────────────
  // AI & INFERENCE
  // ─────────────────────────────────────────────────────────
  ai: {
    chat: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "chat",
      category: "AI & Inference",
      operation: "Analyze",
      tags: ["ai", "chat", "llm", "reasoning"],
      use_cases: ["answer questions", "reasoning", "instruction following", "brainstorming"],
      description:
        "Ask a general-purpose LLM a question or give it an instruction, with an optional system prompt. No external API key required.",
    },
    classify: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "classify",
      category: "AI & Inference",
      operation: "Analyze",
      tags: ["ai", "classify", "nlp", "categorization"],
      use_cases: ["sentiment analysis", "topic classification", "intent detection", "content moderation"],
      description:
        "Classify a text into exactly one of the candidate labels you provide (e.g. sentiment, topic, intent).",
    },
    embed: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "embed",
      category: "AI & Inference",
      operation: "Transform",
      tags: ["ai", "embeddings", "rag", "vector", "semantic-search"],
      use_cases: ["semantic search", "rag retrieval", "similarity matching", "clustering"],
      description:
        "Turn text into a numeric embedding vector for semantic search, RAG and similarity. Multilingual.",
    },
    extract: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "extract",
      // `extract` over MCP is the web scraper (its name since launch); this one
      // keeps the entity-extraction name existing clients already call.
      mcpName: "extract_entities",
      category: "AI & Inference",
      operation: "Extract",
      tags: ["ai", "ner", "nlp", "entity-extraction"],
      use_cases: ["named entity recognition", "information extraction", "data structuring"],
      description:
        "Extract named entities from text — people, organizations, locations, dates and miscellaneous — returned as structured JSON.",
    },
    summarize: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "summarize",
      category: "AI & Inference",
      operation: "Transform",
      tags: ["ai", "summarize", "nlp", "text-reduction"],
      use_cases: ["document summarization", "content condensing", "abstract generation"],
      description:
        "Summarize a block of text into a short abstract, with an optional target length. No external API key required.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // SEARCH & WEB
  // ─────────────────────────────────────────────────────────
  // Nota: no hay operación `search`. Se publicó una el 2026-09-05 sobre
  // backends inexistentes (jina.ai/api/search da 404, s.jina.ai exige clave
  // desde entonces, y las tres instancias SearXNG no resuelven), así que cobraba
  // $0.002 y devolvía error siempre. No hay búsqueda web fiable sin API key: si
  // se reintroduce, hacerlo sobre un proveedor con clave (Brave/Serper/Tavily)
  // y verificarlo con una llamada real contra el Worker desplegado antes de
  // publicarlo.
  web: {
    extract: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.03" },
      visibility: "public",
      httpPath: "web-scraper",
      category: "Search & Web",
      operation: "Fetch",
      tags: ["web", "scrape", "markdown", "rag", "reader", "extraction"],
      use_cases: ["read webpage content", "rag preparation", "article extraction", "content reading"],
      description:
        "Fetch any public web page and return its main content as clean, token-efficient Markdown (title, description, headings, links, lists). Set render:true to execute JavaScript first for single-page apps or JS-heavy pages that would otherwise come back empty. Built for RAG and for agents that need to read the contents of a URL.",
    },
    scrape: {
      channels: ["http"],
      pricing: { x402: "$0.03" },
      visibility: "public",
      httpPath: "scrape",
      category: "Search & Web",
      operation: "Extract",
      tags: ["web", "scrape", "selectors", "extract", "html", "css"],
      use_cases: ["scrape by selector", "extract product data", "table extraction"],
      description:
        "Extract specific elements from a JavaScript-rendered page by CSS selector. Give a list of selectors (e.g. 'h1', '.price', 'a.product') and get back the text and attributes of every match. Backed by a headless browser, so it works on SPAs and JS-heavy pages.",
    },
    links: {
      channels: ["http"],
      pricing: { x402: "$0.03" },
      visibility: "public",
      httpPath: "links",
      category: "Search & Web",
      operation: "Discover",
      tags: ["web", "links", "crawl", "urls", "discovery"],
      use_cases: ["discover page links", "seed crawler", "map site structure"],
      description:
        "Return every hyperlink on a JavaScript-rendered page as a list of absolute URLs, with options to keep only visible links or only same-site links. Backed by a headless browser. Use it to map a site or seed a crawler.",
    },
    extract_structured: {
      channels: ["http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "extract-structured",
      category: "Search & Web",
      operation: "Extract",
      tags: ["web", "ai", "extract", "structured", "json", "schema"],
      use_cases: ["structured data extraction", "ai-powered scraping", "schema-based extraction"],
      description:
        "AI-powered structured extraction: give a URL plus a natural-language prompt and/or a JSON Schema, and get back clean structured JSON (e.g. product name, price, rating). Renders the page in a headless browser first, so it works on SPAs.",
    },
    snapshot: {
      channels: ["http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "snapshot",
      category: "Search & Web",
      operation: "Fetch",
      tags: ["web", "snapshot", "html", "markdown", "accessibility"],
      use_cases: ["multi-format capture", "html + markdown + screenshot"],
      description:
        "Capture several representations of a page in one call — rendered HTML plus a PNG screenshot by default, and optionally Markdown and the accessibility tree. Backed by a headless browser. Saves round-trips when an agent needs both the content and a visual of a page.",
    },
    browser: {
      channels: ["http"],
      pricing: { x402: "$0.10" },
      visibility: "public",
      httpPath: "browser-automate",
      category: "Search & Web",
      operation: "Act",
      tags: ["web", "automation", "click", "forms", "browser", "interaction"],
      use_cases: ["form filling", "multi-step flows", "login automation", "click sequences"],
      description:
        "Drive a headless browser: open a URL and run an ordered list of steps — click, type, press keys, wait, extract text and screenshot. For flows the plain scraper can't reach (logins, forms, multi-step pages).",
    },
    map: {
      channels: ["http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "crawl-map",
      category: "Search & Web",
      operation: "Discover",
      tags: ["web", "crawl", "sitemap", "urls", "discovery"],
      use_cases: ["discover site urls", "map site structure", "sitemap generation"],
      description:
        "Discover all URLs reachable from a domain within a link depth limit. Returns a flat list of absolute URLs, respects robots.txt crawl delays. Use it to map a site's structure before crawling.",
    },
    crawl: {
      channels: ["http"],
      pricing: { x402: "$0.10" },
      visibility: "public",
      httpPath: "crawl",
      category: "Search & Web",
      operation: "Fetch",
      tags: ["web", "crawl", "fetch", "multiple-pages", "depth"],
      use_cases: ["crawl entire sites", "batch page fetch", "deep crawling"],
      description:
        "Crawl multiple pages of a site, respecting link depth and domain limits. Returns async job_id; results include markdown or HTML per page. Use it to fetch and process many pages of content at once.",
    },
    screenshot: {
      channels: ["http"],
      pricing: { x402: "$0.03" },
      visibility: "public",
      httpPath: "screenshot",
      category: "Search & Web",
      operation: "Fetch",
      tags: ["web", "screenshot", "render", "image", "png", "visual"],
      use_cases: ["page screenshot", "visual capture", "full-page render"],
      description:
        "Capture a PNG screenshot of any public URL — full page or just the viewport, at a chosen size — returned base64-encoded. Backed by a headless browser.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // DATA & ANALYTICS
  // ─────────────────────────────────────────────────────────
  time: {
    now: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "time-now",
      category: "Data & Analytics",
      operation: "Fetch",
      tags: ["timezone", "clock"],
      use_cases: ["get current time", "timezone lookup", "local time query"],
      description:
        "Get the current local time in an IANA timezone, including the UTC offset, zone abbreviation and whether DST is in effect. Use whenever you need to know what time it is 'now' somewhere.",
    },
    convert: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "time-convert",
      category: "Data & Analytics",
      operation: "Transform",
      tags: ["timezone", "convert"],
      use_cases: ["convert between timezones", "schedule across zones", "time calculation"],
      description:
        "Convert a specific date/time from one IANA timezone to another (single or batch). Accepts ISO 8601 or natural language ('next Tuesday 3pm'). Returns the converted datetime with UTC offset, zone abbreviation and DST flag.",
    },
    offset: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "time-offset",
      category: "Data & Analytics",
      operation: "Fetch",
      tags: ["timezone", "offset"],
      use_cases: ["get utc offset", "timezone offset lookup"],
      description:
        "Get the exact UTC offset of an IANA timezone at a given instant, DST-aware. Correctly handles fractional offsets such as India +05:30 and Nepal +05:45.",
    },
    timezones: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "timezones",
      category: "Data & Analytics",
      operation: "Discover",
      tags: ["timezone", "lookup", "search"],
      use_cases: ["list timezones", "search timezones", "timezone lookup"],
      description:
        "List or search valid IANA timezone identifiers by city/region/country, and resolve a city/country name to its timezone(s). Use it to discover the exact identifier to pass to the other tools.",
    },
    calculate: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "date-calculate",
      category: "Data & Analytics",
      operation: "Compute",
      tags: ["timezone", "date-math"],
      use_cases: ["date arithmetic", "duration calculation", "time difference"],
      description:
        "Timezone-aware date arithmetic: add or subtract a duration to a datetime (days are calendar-based and DST-safe; hours and minutes are absolute), or compute the difference between two datetimes that may be in different zones.",
    },
    meeting_slots: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.10" },
      visibility: "public",
      httpPath: "meeting-slots",
      category: "Data & Analytics",
      operation: "Compute",
      tags: ["timezone", "scheduler"],
      use_cases: ["find meeting times", "timezone overlap", "schedule coordination"],
      description:
        "Find working-hour time slots that overlap across participants in different timezones for a meeting of a given duration, excluding weekends and (when a country is given per participant) that person's public holidays. Free tier returns at most 1 slot; the paid endpoint returns every matching slot (see 'upgrade' in the response).",
    },
    holiday: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "time-holiday",
      category: "Data & Analytics",
      operation: "Fetch",
      tags: ["timezone", "holidays"],
      use_cases: ["check public holidays", "holiday lookup", "calendar awareness"],
      description:
        "Check whether a given date is a public holiday in a country (identified by its ISO 3166-1 alpha-2 code), and return the holiday name if so. Backed by an authoritative public-holiday dataset.",
    },
  },

  data: {
    currency_convert: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "currency-convert",
      category: "Data & Analytics",
      operation: "Transform",
      tags: ["currency", "fx", "convert", "money", "exchange"],
      use_cases: ["currency conversion", "exchange rates", "money conversion"],
      description:
        "Convert an amount between currencies using live daily exchange rates (ISO 4217 codes, e.g. USD, EUR, GBP, JPY). Returns the converted amount and the rate used.",
    },
    convert_units: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "units-convert",
      category: "Data & Analytics",
      operation: "Transform",
      tags: ["units", "convert", "measurement", "math"],
      use_cases: ["unit conversion", "measurement conversion", "metric conversion"],
      description:
        "Convert a value between units of the same category: length, mass, volume, speed, area, digital storage, time, and temperature (Celsius/Fahrenheit/Kelvin).",
    },
  },

  // ─────────────────────────────────────────────────────────
  // MARKET DATA
  // ─────────────────────────────────────────────────────────
  market: {
    crypto_price: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "crypto-price",
      category: "Market Data",
      operation: "Fetch",
      tags: ["crypto", "price", "defi", "market-data", "ticker"],
      use_cases: ["get crypto prices", "btc/eth lookup", "market data"],
      description:
        "Get live USD spot prices for one or more cryptocurrencies by ticker symbol (e.g. BTC, ETH, SOL).",
    },
  },

  // ─────────────────────────────────────────────────────────
  // MEDIA & GENERATION
  // ─────────────────────────────────────────────────────────
  image: {
    generate: {
      channels: ["http"],
      pricing: { x402: "$0.10" },
      visibility: "public",
      httpPath: "generate-image",
      category: "Media & Generation",
      operation: "Generate",
      tags: ["ai", "image", "text-to-image", "generation"],
      use_cases: ["generate images", "text-to-image", "visual generation"],
      description:
        "Generate an image from a text prompt (returned base64-encoded PNG).",
    },
  },

  audio: {
    transcribe: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "audio-transcribe",
      category: "Media & Generation",
      operation: "Transform",
      tags: ["audio", "speech-to-text", "transcription"],
      use_cases: ["transcribe audio", "speech-to-text", "audio conversion"],
      description:
        "Transcribe an audio file (given by public URL) to text. Handles mp3, wav, m4a, ogg and more.",
    },
    speak: {
      channels: ["http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "audio-speak",
      category: "Media & Generation",
      operation: "Generate",
      tags: ["audio", "text-to-speech", "voice", "generation"],
      use_cases: ["text-to-speech", "voice generation", "audio output"],
      description:
        "Convert text into spoken audio (returned base64-encoded MP3), in several languages.",
    },
  },

  document: {
    pdf: {
      channels: ["http"],
      pricing: { x402: "$0.05" },
      visibility: "public",
      httpPath: "pdf",
      category: "Media & Generation",
      operation: "Generate",
      tags: ["pdf", "render", "document", "html-to-pdf"],
      use_cases: ["generate pdf", "html to pdf", "document creation"],
      description:
        "Render a public URL or a raw HTML string into a PDF document, returned base64-encoded. Backed by a headless browser. Use for invoices, reports, receipts and any HTML-to-PDF need.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // DEVELOPER TOOLS
  // ─────────────────────────────────────────────────────────
  url: {
    shorten: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "shorten",
      category: "Developer Tools",
      operation: "Transform",
      tags: ["url", "shortener", "link", "redirect"],
      use_cases: ["shorten urls", "link shortening", "url compression"],
      description:
        "Shorten a long URL into a compact api.agishub.com/s/<code> link that redirects to the original. Codes are stored for a year.",
    },
  },

  qr: {
    generate: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "qr-generate",
      category: "Developer Tools",
      operation: "Generate",
      tags: ["qr", "generator", "image", "svg", "barcode"],
      use_cases: ["generate qr codes", "qr generation", "barcode creation"],
      description:
        "Generate a QR code for any text or URL. Returns an inline SVG plus a data URI, with selectable size, quiet-zone margin and error-correction level.",
    },
  },

  webhook: {
    send: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "webhook-send",
      category: "Developer Tools",
      operation: "Connect",
      tags: ["webhook", "delivery", "queue", "retry", "integration"],
      use_cases: ["send webhooks", "guaranteed delivery", "event relay"],
      description:
        "Deliver a webhook (POST/PUT/PATCH a JSON payload to a URL) with guaranteed, retried delivery. Returns immediately with a job_id; AgisHub keeps retrying in the background until it succeeds.",
    },
    status: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "webhook-status",
      category: "Developer Tools",
      operation: "Fetch",
      tags: ["webhook", "status", "tracking"],
      use_cases: ["check webhook status", "track delivery"],
      description:
        "Check the delivery status of a webhook job (queued / retrying / delivered / failed) by its job_id.",
    },
  },

  feedback: {
    request_feature: {
      channels: ["mcp"],
      visibility: "public",
      category: "Developer Tools",
      operation: "Connect",
      tags: ["feedback", "feature-request", "roadmap", "support", "community"],
      use_cases: ["request features", "report bugs", "feature suggestions"],
      description:
        "Request a new service, an improvement to an existing tool, or report a bug to the AgisHub team. Use this whenever the capability you need doesn't exist yet, an existing tool falls short, or something is broken — describe what you want and the use case. Free. Your request is posted to the public AgisHub roadmap and the team is notified, so agents (and their humans) can ask for new functionality directly.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // KNOWLEDGE & MEMORY
  // ─────────────────────────────────────────────────────────
  memory: {
    store: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "memory-store",
      category: "Knowledge & Memory",
      operation: "Store",
      tags: ["memory", "rag", "vector", "store", "knowledge"],
      use_cases: ["store knowledge", "memory storage", "rag preparation"],
      description:
        "Store a piece of text in a persistent, searchable memory collection (namespace). Embedded and indexed for later semantic recall.",
    },
    search: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "memory-search",
      category: "Knowledge & Memory",
      operation: "Retrieve",
      tags: ["memory", "rag", "vector", "search", "retrieval"],
      use_cases: ["search memory", "rag retrieval", "knowledge lookup"],
      description:
        "Semantically search a memory collection (namespace) and return the most relevant stored entries. The retrieval half of RAG.",
    },
  },
};

export function catalogEntry(operationId: string): CatalogEntry | undefined {
  const [svc, op] = operationId.split(".");
  return catalog[svc]?.[op];
}
