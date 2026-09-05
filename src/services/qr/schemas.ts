import { z } from "zod";

export const qrCode = z.object({
  text: z.string().min(1).describe("Text or URL to encode in the QR code."),
  size: z.number().int().positive().max(40).optional().describe("Pixel size of each QR module/cell in the SVG (default 6)."),
  margin: z.number().int().nonnegative().max(20).optional().describe("Quiet-zone margin around the code, in cells (default 4)."),
  ec_level: z.enum(["L", "M", "Q", "H"]).optional().describe("Error-correction level: L(7%), M(15%), Q(25%), H(30%). Default M."),
});
