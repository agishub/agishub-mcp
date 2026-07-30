import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import * as B from "./core/browser";

export function pdf(ctx: OperationContext<z.infer<typeof S.pdf>>) {
  return B.pdf(ctx.input, ctx.env);
}

export function screenshot(ctx: OperationContext<z.infer<typeof S.screenshot>>) {
  return B.screenshot(ctx.input, ctx.env);
}
