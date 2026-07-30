import { z } from "zod";

export const memoryUpsert = z.object({
  namespace: z.string().min(1).describe("Your collection key — groups and isolates your memories. Treat it like a secret: anyone with it can read/write this collection."),
  text: z.string().min(1).describe("The text/content to store and make searchable."),
  id: z.string().optional().describe("Optional stable id to update an existing entry; auto-generated if omitted."),
});

export const memorySearch = z.object({
  namespace: z.string().min(1).describe("The namespace to search within (the same key used on upsert)."),
  query: z.string().min(1).describe("Natural-language query; returns the most semantically similar stored entries."),
  top_k: z.number().int().min(1).max(20).optional().describe("How many results to return (default 5)."),
});
