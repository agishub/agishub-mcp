import { z } from "zod";

export const generate = z.object({
  prompt: z.string().min(1).describe("Text description of the image to generate."),
  steps: z.number().int().min(1).max(8).optional().describe("Diffusion steps (1-8, default 4). More = higher quality but slower."),
});
