/**
 * Zod input schemas for the document service (Cloudflare Browser Rendering).
 */
import { z } from "zod";

export const pdf = z.object({
  url: z.string().url().optional().describe("Public http/https URL to render to PDF. Provide this OR html."),
  html: z.string().optional().describe("Raw HTML string to render to PDF. Provide this OR url."),
  landscape: z.boolean().optional().describe("Landscape orientation (default false = portrait)."),
  format: z
    .enum(["A4", "Letter", "Legal", "A3", "A5", "Tabloid"])
    .optional()
    .describe("Paper size (default A4)."),
});
