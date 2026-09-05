import { z } from "zod";

export const convertCurrency = z.object({
  amount: z.number().describe("The amount of money to convert."),
  from: z.string().length(3).describe("Source currency ISO 4217 code, e.g. 'USD', 'EUR'."),
  to: z.string().length(3).describe("Target currency ISO 4217 code, e.g. 'EUR', 'JPY'."),
});

export const convertUnits = z.object({
  value: z.number().describe("The numeric value to convert."),
  from: z.string().describe("Source unit, e.g. 'km', 'mi', 'kg', 'lb', 'C', 'F', 'GB', 'm/s'."),
  to: z.string().describe("Target unit in the SAME category as 'from', e.g. 'mi', 'km', 'lb', 'F'."),
});
