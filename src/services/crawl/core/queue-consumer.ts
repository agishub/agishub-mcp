/**
 * Queue consumer for crawl jobs. Processes each queued page:
 * 1. Fetch URL (static first, render if empty)
 * 2. Extract to markdown/HTML
 * 3. Save to D1
 * 4. Update job progress
 */

import { extractCore } from "../../web/core/extract";
import { updateCrawlJob, getCrawlStatus } from "./crawl";
import type { Env } from "../../../types";

export interface CrawlPageMessage {
  action: "crawl_page";
  job_id: string;
  url: string;
  formats: string[];
}

const MAX_ATTEMPTS = 3;

export async function handleCrawlQueueMessage(
  msg: Message<CrawlPageMessage>,
  env: Env,
): Promise<void> {
  const { job_id, url, formats } = msg.body;

  try {
    // Get current job state
    const job = await getCrawlStatus(job_id, env);
    if (!job) {
      msg.ack(); // Job gone, skip
      return;
    }

    // Extract page content
    const extracted = await extractCoreCrawl(url, formats, env);

    // Update job with new page result
    const updatedPages = job.pages.map(p =>
      p.url === url
        ? {
            ...p,
            status: "done",
            markdown: formats.includes("markdown") ? extracted.markdown : undefined,
            html: formats.includes("html") ? extracted.html : undefined,
          }
        : p,
    );

    const progress = {
      crawled: updatedPages.filter(p => p.status === "done").length,
      total: updatedPages.length,
    };

    const status = progress.crawled === progress.total ? "completed" : "crawling";

    await updateCrawlJob(
      job_id,
      {
        ...job,
        pages: updatedPages,
        progress,
        status,
        crawled_at: new Date().toISOString(),
      },
      env,
    );

    msg.ack();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`Crawl page failed (${url}):`, error);

    // Update job with error
    const job = await getCrawlStatus(job_id, env);
    if (job) {
      const updatedPages = job.pages.map(p =>
        p.url === url
          ? {
              ...p,
              status: "error",
              error,
            }
          : p,
      );

      await updateCrawlJob(
        job_id,
        {
          ...job,
          pages: updatedPages,
        },
        env,
      );
    }

    // Retry or ack based on attempts
    if (msg.attempts >= MAX_ATTEMPTS) {
      msg.ack();
    } else {
      msg.retry();
    }
  }
}

/**
 * Extract page to markdown/HTML (internal version for crawler).
 * Tries static fetch first, falls back to render if empty.
 */
async function extractCoreCrawl(
  url: string,
  formats: string[],
  env: Env,
): Promise<{ markdown?: string; html?: string }> {
  const result: { markdown?: string; html?: string } = {};

  if (formats.includes("markdown")) {
    const extracted = await extractCore(
      {
        url,
        render: false, // Try static first
        include_links: true,
        include_images: false,
      },
      env,
    );

    // If empty, retry with render
    if (!extracted.markdown || extracted.markdown.length < 100) {
      const rendered = await extractCore(
        {
          url,
          render: true,
          include_links: true,
          include_images: false,
        },
        env,
      );
      result.markdown = rendered.markdown;
    } else {
      result.markdown = extracted.markdown;
    }
  }

  if (formats.includes("html")) {
    // Render to get HTML
    try {
      const response = await (env.BROWSER as any)?.render(url, { timeout: 15000 });
      result.html = response?.html;
    } catch (e) {
      console.error(`Failed to render ${url} for HTML:`, e);
      // Continue without HTML
    }
  }

  return result;
}
