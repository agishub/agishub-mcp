import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { automate, type Step } from "./core/run";

export function browser_automate(ctx: OperationContext<z.infer<typeof S.automate>>) {
  const { url, steps, screenshot } = ctx.input;
  return automate(ctx.env, url, (steps ?? []) as Step[], screenshot ?? false);
}
