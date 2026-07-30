import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { makeQr } from "./core/qr";
import { convert } from "./core/units";

export function qr_code(ctx: OperationContext<z.infer<typeof S.qrCode>>) {
  const { text, size, margin, ec_level } = ctx.input;
  return makeQr(text, size, margin, ec_level);
}

export function convert_units(ctx: OperationContext<z.infer<typeof S.convertUnits>>) {
  const { value, from, to } = ctx.input;
  return convert(value, from, to);
}
