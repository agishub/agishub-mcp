/**
 * Pure handlers for crawl service. Validated input in, JSON out.
 */

import type { z } from "zod";
import type { OperationContext } from "../types";
import { mapCore } from "./core/map";
import { crawlCore, getCrawlStatus } from "./core/crawl";
import * as S from "./schemas";

export async function map(ctx: OperationContext<z.infer<typeof S.map>>) {
  const { url, limit = 100, include_subdomains = false, search } = ctx.input;

  const result = await mapCore(
    {
      url,
      limit,
      include_subdomains,
      search,
    },
    ctx.env,
  );

  return {
    url,
    discovered: result.urls.length,
    limit,
    urls: result.urls,
    metadata: result.metadata,
  };
}

export async function crawl(ctx: OperationContext<z.infer<typeof S.crawl>>) {
  const { url, limit = 100, max_depth = 2, formats = ["markdown"], same_domain = true } = ctx.input;

  // Crawl is asynchronous: return immediately with job_id
  const jobId = await crawlCore(
    {
      url,
      limit,
      max_depth,
      formats,
      same_domain,
    },
    ctx.env,
  );

  return {
    job_id: jobId,
    status: "queued",
    url,
    limit,
    max_depth,
    message: `Crawl queued. Poll GET /v1/crawl/${jobId} to check status and retrieve results.`,
  };
}

export async function crawlStatus(ctx: OperationContext<z.infer<typeof S.crawlStatus>>) {
  const { job_id } = ctx.input;

  const status = await getCrawlStatus(job_id, ctx.env);

  if (!status) {
    return {
      job_id,
      status: "not_found",
      error: "Job ID not found or expired.",
    };
  }

  return status;
}
