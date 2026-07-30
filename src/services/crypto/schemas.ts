import { z } from "zod";

export const price = z.object({
  symbols: z.string().describe("Comma-separated ticker symbols, e.g. 'BTC,ETH,SOL'. Prices are returned in USD."),
});
