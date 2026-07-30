import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { price as core } from "./core/prices";

export function price(ctx: OperationContext<z.infer<typeof S.price>>) {
  return core(ctx.input.symbols);
}
