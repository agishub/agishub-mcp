import { z } from "zod";

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
