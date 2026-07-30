import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { runAi } from "../../ai-budget";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

export async function generate(ctx: OperationContext<z.infer<typeof S.generate>>) {
  const { prompt, steps } = ctx.input;
  const r = (await runAi(ctx, MODEL, { prompt, steps: steps ?? 4 }, "image")) as { image?: string };
  const base64 = r?.image ?? "";
  return {
    format: "png",
    prompt,
    base64,
    data_uri: `data:image/png;base64,${base64}`,
    model: MODEL,
  };
}
