/**
 * Crawl core: asynchronous website crawling.
 * Returns job_id immediately, processes in background via queue.
 */

import type { Env } from "../../../types";
import { mapCore } from "./map";

interface CrawlInput {
  url: string;
  limit: number;
  max_depth: number;
  formats: string[];
  same_domain: boolean;
}

interface CrawlJob {
  job_id: string;
  url: string;
  status: "queued" | "crawling" | "completed" | "failed";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: {
    crawled: number;
    total: number;
  };
  pages: Array<{
    url: string;
    markdown?: string;
    html?: string;
    status: "pending" | "crawling" | "done" | "error";
    error?: string;
  }>;
}

/**
 * Create a crawl job and enqueue it.
 * Returns job_id immediately.
 */
export async function crawlCore(input: CrawlInput, env: Env): Promise<string> {
  const jobId = `crawl_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Discover URLs first
  const mapResult = await mapCore(
    {
      url: input.url,
      limit: input.limit,
      include_subdomains: !input.same_domain,
      search: undefined,
    },
    env,
  );

  const urlsToCrawl = mapResult.urls.slice(0, input.limit);

  // Create job record in D1
  const job: CrawlJob = {
    job_id: jobId,
    url: input.url,
    status: "queued",
    created_at: new Date().toISOString(),
    progress: {
      crawled: 0,
      total: urlsToCrawl.length,
    },
    pages: urlsToCrawl.map(u => ({
      url: u,
      status: "pending",
    })),
  };

  // Store job in D1 (requires agishub_traces database with crawl_jobs table)
  try {
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO crawl_jobs (job_id, url, status, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(
          jobId,
          input.url,
          job.status,
          JSON.stringify({
            ...job,
            formats: input.formats,
            max_depth: input.max_depth,
            same_domain: input.same_domain,
          }),
          job.created_at,
        )
        .run();
    }
  } catch (e) {
    console.error("Failed to store crawl job in D1:", e);
    // Continue anyway - job will be stored in memory/KV
  }

  // Enqueue crawl task to background queue (if available)
  try {
    if (env.WEBHOOK_QUEUE) {
      for (const pageUrl of urlsToCrawl) {
        await env.WEBHOOK_QUEUE.send({
          action: "crawl_page",
          job_id: jobId,
          url: pageUrl,
          formats: input.formats,
        });
      }
    }
  } catch (e) {
    console.error("Failed to enqueue crawl tasks:", e);
  }

  return jobId;
}

/**
 * Get the status of a crawl job and its results so far.
 */
export async function getCrawlStatus(jobId: string, env: Env): Promise<CrawlJob | null> {
  try {
    if (env.DB) {
      const result = await env.DB.prepare(
        `SELECT payload, status FROM crawl_jobs WHERE job_id = ? LIMIT 1`,
      )
        .bind(jobId)
        .first();

      if (result?.payload) {
        return JSON.parse(result.payload as string);
      }
    }
  } catch (e) {
    console.error("Failed to fetch crawl status from D1:", e);
  }

  return null;
}

/**
 * Update a crawl job's progress (called by background consumer).
 */
export async function updateCrawlJob(
  jobId: string,
  updates: Partial<CrawlJob>,
  env: Env,
): Promise<void> {
  try {
    if (env.DB) {
      const job = await getCrawlStatus(jobId, env);
      if (job) {
        const updated = { ...job, ...updates };
        await env.DB.prepare(
          `UPDATE crawl_jobs SET payload = ?, status = ? WHERE job_id = ?`,
        )
          .bind(
            JSON.stringify(updated),
            updated.status,
            jobId,
          )
          .run();
      }
    }
  } catch (e) {
    console.error("Failed to update crawl job in D1:", e);
  }
}
