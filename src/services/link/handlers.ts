import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { shorten as core } from "./core/store";

const BASE = "https://api.agishub.com";

export function shorten(ctx: OperationContext<z.infer<typeof S.shorten>>) {
  return core(ctx.env, ctx.input.url, BASE);
}
