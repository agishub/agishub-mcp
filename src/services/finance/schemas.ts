import { z } from "zod";

export const convertCurrency = z.object({
  amount: z.number().describe("The amount of money to convert."),
  from: z.string().length(3).describe("Source currency ISO 4217 code, e.g. 'USD', 'EUR'."),
  to: z.string().length(3).describe("Target currency ISO 4217 code, e.g. 'EUR', 'JPY'."),
});
