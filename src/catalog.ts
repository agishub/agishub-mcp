/**
 * Catalog — publication + commercialization, kept separate from Operations.
 * It answers "WHERE is this operation published and at what price/visibility",
 * NOT "how does the caller authenticate" (that's Billing's job). Structured as a
 * tree by service so it stays manageable as services grow.
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
}

export type Catalog = Record<string, Record<string, CatalogEntry>>;

const COMMODITY = "$0.001";

export const catalog: Catalog = {
  timezone: {
    now_in: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "now-in",
      tags: ["timezone", "clock"],
      description:
        "Get the current local time in an IANA timezone, including the UTC offset, zone abbreviation and whether DST is in effect. Use whenever you need to know what time it is 'now' somewhere.",
    },
    convert_timezone: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "convert-timezone",
      tags: ["timezone", "convert"],
      description:
        "Convert a specific date/time from one IANA timezone to another. Accepts ISO 8601 or natural language ('next Tuesday 3pm'). Returns the converted datetime with its UTC offset, zone abbreviation and DST flag.",
    },
    convert_batch: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "convert-batch",
      tags: ["timezone", "world-clock"],
      description:
        "Convert a single instant into many IANA timezones at once — a world-clock view. Like convert_timezone, but 'to' is a list of target zones.",
    },
    tz_offset: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "tz-offset",
      tags: ["timezone", "offset"],
      description:
        "Get the exact UTC offset of an IANA timezone at a given instant, DST-aware. Correctly handles fractional offsets such as India +05:30 and Nepal +05:45.",
    },
    list_timezones: {
      channels: ["mcp"],
      visibility: "public",
      tags: ["timezone", "list"],
      description:
        "List or search valid IANA timezone identifiers, optionally filtered by a city, region or country substring (e.g. 'kolkata', 'america'). Use it to discover the exact identifier to pass to the other tools.",
    },
    lookup_timezone: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "lookup-timezone",
      tags: ["timezone", "lookup"],
      description:
        "Resolve a city or country name to its IANA timezone(s) so you don't need the exact identifier — e.g. 'Delhi' -> 'Asia/Kolkata'. Use it first when you only have a place name.",
    },
    date_math: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "date-math",
      tags: ["timezone", "date-math"],
      description:
        "Timezone-aware date arithmetic: add or subtract a duration to a datetime (days are calendar-based and DST-safe; hours and minutes are absolute), or compute the difference between two datetimes that may be in different zones.",
    },
    find_meeting_slots: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "find-meeting-slots",
      tags: ["timezone", "scheduler"],
      description:
        "Find working-hour time slots that overlap across participants in different timezones for a meeting of a given duration, excluding weekends and (when a country is given per participant) that person's public holidays. Free tier returns at most 1 slot; the paid endpoint returns every matching slot (see 'upgrade' in the response).",
    },
    is_holiday: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "is-holiday",
      tags: ["timezone", "holidays"],
      description:
        "Check whether a given date is a public holiday in a country (identified by its ISO 3166-1 alpha-2 code), and return the holiday name if so. Backed by an authoritative public-holiday dataset.",
    },
  },
  web: {
    extract: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.004" },
      visibility: "public",
      httpPath: "web-scraper",
      tags: ["web", "scrape", "markdown", "rag", "reader"],
      description:
        "Fetch any public web page and return its main content as clean, token-efficient Markdown (title, description, headings, links, lists). Set render:true to execute JavaScript first for single-page apps or JS-heavy pages that would otherwise come back empty. Built for RAG and for agents that need to read the contents of a URL.",
    },
  },
  render: {
    pdf: {
      channels: ["http"],
      pricing: { x402: "$0.008" },
      visibility: "public",
      httpPath: "pdf",
      tags: ["pdf", "render", "document", "html-to-pdf"],
      description:
        "Render a public URL or a raw HTML string into a PDF document, returned base64-encoded. Backed by a headless browser. Use for invoices, reports, receipts and any HTML-to-PDF need.",
    },
    screenshot: {
      channels: ["http"],
      pricing: { x402: "$0.006" },
      visibility: "public",
      httpPath: "screenshot",
      tags: ["screenshot", "render", "image", "png"],
      description:
        "Capture a PNG screenshot of any public URL — full page or just the viewport, at a chosen size — returned base64-encoded. Backed by a headless browser.",
    },
  },
  utils: {
    qr_code: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "qr-code",
      tags: ["qr", "generator", "image", "svg"],
      description:
        "Generate a QR code for any text or URL. Returns an inline SVG plus a data URI, with selectable size, quiet-zone margin and error-correction level.",
    },
    convert_units: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "convert-units",
      tags: ["convert", "units", "math"],
      description:
        "Convert a value between units of the same category: length, mass, volume, speed, area, digital storage, time, and temperature (Celsius/Fahrenheit/Kelvin).",
    },
  },
  finance: {
    convert_currency: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "convert-currency",
      tags: ["currency", "fx", "convert", "money"],
      description:
        "Convert an amount between currencies using live daily exchange rates (ISO 4217 codes, e.g. USD, EUR, GBP, JPY). Returns the converted amount and the rate used.",
    },
  },
  ai: {
    summarize: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.003" },
      visibility: "public",
      httpPath: "summarize",
      tags: ["ai", "summarize", "nlp"],
      description:
        "Summarize a block of text into a short abstract, with an optional target length. No external API key required.",
    },
    classify: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.002" },
      visibility: "public",
      httpPath: "classify",
      tags: ["ai", "classify", "nlp"],
      description:
        "Classify a text into exactly one of the candidate labels you provide (e.g. sentiment, topic, intent).",
    },
    extract_entities: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.003" },
      visibility: "public",
      httpPath: "extract-entities",
      tags: ["ai", "ner", "nlp"],
      description:
        "Extract named entities from text — people, organizations, locations, dates and miscellaneous — returned as structured JSON.",
    },
    transcribe: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.006" },
      visibility: "public",
      httpPath: "transcribe",
      tags: ["ai", "speech-to-text", "audio"],
      description:
        "Transcribe an audio file (given by public URL) to text. Handles mp3, wav, m4a, ogg and more.",
    },
    // ocr: parked — vision models need either a one-time Meta license 'agree'
    // (llama-3.2-vision) or accept llava's slowness; re-enable once resolved.
    embed: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "embed",
      tags: ["ai", "embeddings", "rag", "vector"],
      description:
        "Turn text into a numeric embedding vector for semantic search, RAG and similarity. Multilingual.",
    },
    chat: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.003" },
      visibility: "public",
      httpPath: "chat",
      tags: ["ai", "chat", "llm"],
      description:
        "Ask a general-purpose LLM a question or give it an instruction, with an optional system prompt. No external API key required.",
    },
    tts: {
      channels: ["http"],
      pricing: { x402: "$0.005" },
      visibility: "public",
      httpPath: "tts",
      tags: ["ai", "text-to-speech", "audio", "voice"],
      description:
        "Convert text into spoken audio (returned base64-encoded MP3), in several languages.",
    },
  },
  rag: {
    memory_upsert: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "memory-upsert",
      tags: ["rag", "memory", "vector", "store"],
      description:
        "Store a piece of text in a persistent, searchable memory collection (namespace). Embedded and indexed for later semantic recall.",
    },
    memory_search: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "memory-search",
      tags: ["rag", "memory", "vector", "search"],
      description:
        "Semantically search a memory collection (namespace) and return the most relevant stored entries. The retrieval half of RAG.",
    },
  },
  webhook: {
    relay: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.002" },
      visibility: "public",
      httpPath: "webhook-relay",
      tags: ["webhook", "delivery", "queue", "retry"],
      description:
        "Deliver a webhook (POST/PUT/PATCH a JSON payload to a URL) with guaranteed, retried delivery. Returns immediately with a job_id; AgisHub keeps retrying in the background until it succeeds.",
    },
    status: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "webhook-status",
      tags: ["webhook", "status"],
      description:
        "Check the delivery status of a webhook job (queued / retrying / delivered / failed) by its job_id.",
    },
  },
  browser: {
    automate: {
      channels: ["http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "browser-automate",
      tags: ["browser", "automation", "click", "forms"],
      description:
        "Drive a headless browser: open a URL and run an ordered list of steps — click, type, press keys, wait, extract text and screenshot. For flows the plain scraper can't reach (logins, forms, multi-step pages).",
    },
  },
  crypto: {
    price: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "crypto-price",
      tags: ["crypto", "price", "defi", "market-data"],
      description:
        "Get live USD spot prices for one or more cryptocurrencies by ticker symbol (e.g. BTC, ETH, SOL).",
    },
  },
  image: {
    generate: {
      channels: ["http"],
      pricing: { x402: "$0.01" },
      visibility: "public",
      httpPath: "generate-image",
      tags: ["ai", "image", "text-to-image"],
      description:
        "Generate an image from a text prompt (returned base64-encoded PNG).",
    },
  },
  link: {
    shorten: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.001" },
      visibility: "public",
      httpPath: "shorten",
      tags: ["url", "shortener", "link"],
      description:
        "Shorten a long URL into a compact api.agishub.com/s/<code> link that redirects to the original. Codes are stored for a year.",
    },
  },
};

export function catalogEntry(operationId: string): CatalogEntry | undefined {
  const [svc, op] = operationId.split(".");
  return catalog[svc]?.[op];
}
