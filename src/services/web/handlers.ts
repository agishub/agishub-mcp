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
  // JavaScript rendering uses (metered) Browser Rendering. On the free MCP channel
  // we force a static fetch so free usage can't run up a Browser Rendering bill;
  // render:true is honoured only on the paid HTTP endpoint.
  const mcp = ctx.transport === "mcp";
  const result = await extractCore(
    { url, render: mcp ? false : render, include_links, include_images, max_chars },
    ctx.env,
  );
  if (mcp && render) {
    return {
      ...result,
      note: "JavaScript rendering is only available on the paid HTTP endpoint (/paid/web-scraper, x402). Returned the static fetch.",
    };
  }
  return result;
}
