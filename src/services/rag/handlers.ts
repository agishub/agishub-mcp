import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { upsert, search } from "./core/store";

export function memory_upsert(ctx: OperationContext<z.infer<typeof S.memoryUpsert>>) {
  const { namespace, text, id } = ctx.input;
  return upsert(ctx, namespace, text, id);
}

export function memory_search(ctx: OperationContext<z.infer<typeof S.memorySearch>>) {
  const { namespace, query, top_k } = ctx.input;
  return search(ctx, namespace, query, top_k ?? 5);
}
