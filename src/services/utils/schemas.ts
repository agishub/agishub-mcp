import { z } from "zod";

export const qrCode = z.object({
  text: z.string().min(1).describe("Text or URL to encode in the QR code."),
  size: z.number().int().positive().max(40).optional().describe("Pixel size of each QR module/cell in the SVG (default 6)."),
  margin: z.number().int().nonnegative().max(20).optional().describe("Quiet-zone margin around the code, in cells (default 4)."),
  ec_level: z.enum(["L", "M", "Q", "H"]).optional().describe("Error-correction level: L(7%), M(15%), Q(25%), H(30%). Default M."),
});

export const convertUnits = z.object({
  value: z.number().describe("The numeric value to convert."),
  from: z.string().describe("Source unit, e.g. 'km', 'mi', 'kg', 'lb', 'C', 'F', 'GB', 'm/s'."),
  to: z.string().describe("Target unit in the SAME category as 'from', e.g. 'mi', 'km', 'lb', 'F'."),
});
