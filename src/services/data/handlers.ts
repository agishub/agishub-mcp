import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { convertCurrency as core } from "./core/fx";
import { convert } from "./core/units";

export function currency_convert(ctx: OperationContext<z.infer<typeof S.convertCurrency>>) {
  const { amount, from, to } = ctx.input;
  return core(amount, from, to);
}

export function convert_units(ctx: OperationContext<z.infer<typeof S.convertUnits>>) {
  const { value, from, to } = ctx.input;
  return convert(value, from, to);
}
