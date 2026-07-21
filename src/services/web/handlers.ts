/**
 * Pure handler for the web service. Validated input in, plain JSON out; the HTTP
 * adapter returns it directly. Extraction logic lives in ./core/extract.
 */

import type { z } from "zod";
import type { OperationContext } from "../types";
import { extract as extractCore } from "./core/extract";
import * as S from "./schemas";

export async function extract(ctx: OperationContext<z.infer<typeof S.extract>>) {
  const { url, render, include_links, include_images, max_chars } = ctx.input;
  return extractCore({ url, render, include_links, include_images, max_chars }, ctx.env);
}
