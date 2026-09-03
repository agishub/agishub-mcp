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
