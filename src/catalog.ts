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
        "Current local time in an IANA timezone, with UTC offset, abbreviation and DST flag. Use whenever you need to know 'now'.",
    },
    convert_timezone: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "convert-timezone",
      tags: ["timezone", "convert"],
      description:
        "Convert a date/time from one IANA timezone to another. Accepts ISO 8601 or natural language ('next Tuesday 3pm'). Returns converted datetime, offset, abbreviation and DST flag.",
    },
    convert_batch: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "convert-batch",
      tags: ["timezone", "world-clock"],
      description:
        "Like convert_timezone but converts a single instant into many target timezones at once. Ideal for world-clock views.",
    },
    tz_offset: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "tz-offset",
      tags: ["timezone", "offset"],
      description:
        "Exact UTC offset of a timezone at a given instant (DST-aware). Handles fractional offsets like India +05:30 and Nepal +05:45.",
    },
    list_timezones: {
      channels: ["mcp"],
      visibility: "public",
      tags: ["timezone", "list"],
      description:
        "List or search valid IANA timezone names. Filter by city, region or country substring (e.g. 'kolkata', 'america').",
    },
    lookup_timezone: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "lookup-timezone",
      tags: ["timezone", "lookup"],
      description:
        "Resolve a city or country name to its IANA timezone(s), so you don't need the exact identifier. E.g. 'Delhi' -> Asia/Kolkata.",
    },
    date_math: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "date-math",
      tags: ["timezone", "date-math"],
      description:
        "Add/subtract time to a date respecting DST (days are calendar-based, hours/minutes are absolute), or compute the difference between two datetimes in different zones.",
    },
    find_meeting_slots: {
      channels: ["mcp", "http"],
      pricing: { x402: "$0.02" },
      visibility: "public",
      httpPath: "find-meeting-slots",
      tags: ["timezone", "scheduler"],
      description:
        "Suggest overlapping working-hour slots for a meeting across timezones (excludes weekends and, if a country code is given per participant, public holidays). FREE TIER: returns at most 1 slot; get ALL matching slots via the paid endpoint (see 'upgrade' in the response).",
    },
    is_holiday: {
      channels: ["mcp", "http"],
      pricing: { x402: COMMODITY },
      visibility: "public",
      httpPath: "is-holiday",
      tags: ["timezone", "holidays"],
      description:
        "Check whether a date is a public holiday in a country (ISO 3166-1 alpha-2). Data from the free Nager.Date service.",
    },
  },
  web: {
    extract: {
      channels: ["http"],
      pricing: { x402: "$0.004" },
      visibility: "public",
      httpPath: "extract",
      tags: ["web", "scrape", "markdown", "rag", "reader"],
      description:
        "Agis Web Scraper — Fetch any public web page and return its main content as clean markdown (title, description, headings, links, lists). Optional JavaScript rendering (render:true) for SPAs / JS-heavy pages. Ideal for RAG and agents that need to read a URL. Paid-only (x402, USDC on Base).",
    },
  },
};

export function catalogEntry(operationId: string): CatalogEntry | undefined {
  const [svc, op] = operationId.split(".");
  return catalog[svc]?.[op];
}
