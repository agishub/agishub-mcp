import { z } from "zod";

export const request_feature = z.object({
  title: z
    .string()
    .min(3)
    .max(120)
    .describe(
      "A short, specific title for the request, e.g. 'Add a PDF-merge tool' or 'Support Solana in crypto.price'.",
    ),
  details: z
    .string()
    .min(10)
    .max(4000)
    .describe(
      "What you want and why: the new service, the improvement to an existing one, or the bug. Be concrete about the use case so it can be prioritized.",
    ),
  type: z
    .enum(["new_service", "improvement", "bug", "other"])
    .default("other")
    .describe(
      "The kind of request: a brand-new service, an improvement to an existing one, a bug report, or other feedback.",
    ),
  service: z
    .string()
    .max(60)
    .optional()
    .describe("Optional: the existing service/tool this relates to, e.g. 'crypto.price' or 'web.extract'."),
  contact: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Optional: how the team can reach you for follow-up — an email, an X/GitHub handle, or a wallet address. Leave empty to stay anonymous.",
    ),
});
