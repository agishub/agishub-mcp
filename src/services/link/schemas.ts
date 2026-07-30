import { z } from "zod";

export const shorten = z.object({
  url: z.string().url().describe("The long http/https URL to shorten."),
});
