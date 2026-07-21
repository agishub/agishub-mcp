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
