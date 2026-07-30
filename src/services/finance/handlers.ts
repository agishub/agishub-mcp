import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { convertCurrency as core } from "./core/fx";

export function convert_currency(ctx: OperationContext<z.infer<typeof S.convertCurrency>>) {
  const { amount, from, to } = ctx.input;
  return core(amount, from, to);
}
