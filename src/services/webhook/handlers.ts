import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { relay, status } from "./core/relay";

export function webhook_relay(ctx: OperationContext<z.infer<typeof S.relay>>) {
  const { url, payload, method, headers } = ctx.input;
  return relay(ctx.env, url, payload, method ?? "POST", headers);
}

export function webhook_status(ctx: OperationContext<z.infer<typeof S.status>>) {
  return status(ctx.env, ctx.input.job_id);
}
