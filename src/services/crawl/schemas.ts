/**
 * Zod input schemas for the crawl service.
 */

import { z } from "zod";

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

export const crawlStatus = z.object({
  job_id: z.string().describe("Job ID returned from POST /v1/crawl, used to check status and retrieve results."),
});
