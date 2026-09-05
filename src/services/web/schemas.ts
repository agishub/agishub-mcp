/**
 * Zod input schema for the web service. The HTTP adapter uses `.parse()` and
 * derives the OpenAPI JSON Schema from it.
 */

import { z } from "zod";

export const extract = z.object({
  url: z.string().url().describe("Full http/https URL of the page to extract."),
  render: z
    .boolean()
    .optional()
    .describe(
      "Render JavaScript with a headless browser before extracting (default false). Enable for SPAs / JS-heavy pages that return empty content otherwise. Slower.",
    ),
  include_links: z.boolean().optional().describe("Keep hyperlinks in the markdown output (default true)."),
  include_images: z.boolean().optional().describe("Keep images as markdown (default false)."),
  max_chars: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Truncate the markdown to at most this many characters (sets truncated:true)."),
});

// ── Browser Rendering Quick Actions (paid HTTP channel) ───────────────────────

export const scrape = z.object({
  url: z.string().url().describe("Full http/https URL of the page to scrape."),
  selectors: z
    .array(z.string().min(1))
    .min(1)
    .max(20)
    .describe("CSS selectors to extract, e.g. ['h1', 'a.product', '.price']. Returns the text and attributes of every match per selector."),
});

export const links = z.object({
  url: z.string().url().describe("Full http/https URL of the page to read links from."),
  visible_only: z.boolean().optional().describe("Return only links visible in the rendered layout (default false)."),
  exclude_external: z.boolean().optional().describe("Drop links pointing to other domains, keeping only same-site links (default false)."),
});

export const structured = z.object({
  url: z.string().url().describe("Full http/https URL of the page to extract data from."),
  prompt: z
    .string()
    .optional()
    .describe("Natural-language instruction of what to extract, e.g. 'the product name, price and rating'. Provide this and/or a schema."),
  schema: z
    .record(z.any())
    .optional()
    .describe("Optional JSON Schema object describing the exact shape of the data to return. When given, the output is constrained to it."),
});

export const snapshot = z.object({
  url: z.string().url().describe("Full http/https URL to capture."),
  formats: z
    .array(z.enum(["html", "screenshot", "markdown", "accessibilityTree"]))
    .optional()
    .describe("Which representations to return (default ['html','screenshot']). Add 'markdown' and/or 'accessibilityTree' as needed."),
  full_page: z.boolean().optional().describe("Capture the full scrollable page in the screenshot instead of just the viewport (default false)."),
  width: z.number().int().positive().optional().describe("Viewport width in pixels (default 1280)."),
  height: z.number().int().positive().optional().describe("Viewport height in pixels (default 800)."),
});

// ── Consolidated from browser, crawl, render ──────────────────────────────

const step = z.object({
  action: z.enum(["click", "type", "press", "wait", "extract_text", "screenshot"]).describe("What to do."),
  selector: z.string().optional().describe("CSS selector (for click/type/wait-for/extract_text)."),
  text: z.string().optional().describe("Text to type (type), or key to press (press, e.g. 'Enter')."),
  ms: z.number().int().min(0).max(10000).optional().describe("Milliseconds to wait (wait, when no selector given)."),
});

export const automate = z.object({
  url: z.string().url().describe("Starting URL to open in a headless browser."),
  steps: z.array(step).max(20).optional().describe("Ordered actions to perform after the page loads."),
  screenshot: z.boolean().optional().describe("Also return a final full-page PNG screenshot (base64)."),
});

export const map = z.object({
  url: z.string().url().describe("Root domain URL to map (e.g., https://example.com)."),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe("Maximum URLs to return (default 100, max 500). Respects robots.txt crawl-delay."),
  include_subdomains: z
    .boolean()
    .optional()
    .describe("Include URLs from subdomains (default false, same domain only)."),
  search: z
    .string()
    .optional()
    .describe("Optional regex or plain string to filter results (case-insensitive)."),
});

export const crawl = z.object({
  url: z.string().url().describe("Root domain URL to crawl (e.g., https://example.com)."),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe("Maximum pages to crawl (default 100, max 1000). Returns 202 with job_id for async processing."),
  max_depth: z
    .number()
    .int()
    .positive()
    .max(10)
    .optional()
    .describe("Maximum link depth from root (default 2, max 10). Depth 0 = root only, depth 1 = root + direct children."),
  formats: z
    .array(z.enum(["markdown", "html"]))
    .optional()
    .describe("Output formats per page (default ['markdown']). 'html' adds raw HTML."),
  same_domain: z
    .boolean()
    .optional()
    .describe("Only crawl URLs on the same domain (default true). Subdomain links are excluded when false."),
});

export const screenshot = z.object({
  url: z.string().url().describe("Public http/https URL to capture."),
  full_page: z.boolean().optional().describe("Capture the entire scrollable page instead of just the viewport (default false)."),
  width: z.number().int().positive().optional().describe("Viewport width in pixels (default 1280)."),
  height: z.number().int().positive().optional().describe("Viewport height in pixels (default 800)."),
});

