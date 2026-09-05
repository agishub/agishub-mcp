import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { makeQr } from "./core/qr";

export function generate(ctx: OperationContext<z.infer<typeof S.qrCode>>) {
  const { text, size, margin, ec_level } = ctx.input;
  return makeQr(text, size, margin, ec_level);
}
