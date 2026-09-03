-- Create crawl_jobs table for Sprint 2.1 (/v1/crawl endpoint)
-- Stores async crawl job state, progress, and results.

CREATE TABLE IF NOT EXISTS crawl_jobs (
  -- Primary key
  job_id TEXT PRIMARY KEY,

  -- Request metadata
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'crawling', 'completed', 'failed')),

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,

  -- Job payload (JSON): full request params, progress, pages array, etc.
  payload TEXT NOT NULL, -- JSON-serialized CrawlJob object

  -- Indexing for efficient queries
  created_at_index TEXT GENERATED ALWAYS AS (created_at) STORED
);

CREATE INDEX IF NOT EXISTS crawl_jobs_status_idx ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS crawl_jobs_created_idx ON crawl_jobs(created_at);
CREATE INDEX IF NOT EXISTS crawl_jobs_url_idx ON crawl_jobs(url);

-- Cleanup: cascade delete old jobs after 7 days (optional, run separately)
-- DELETE FROM crawl_jobs WHERE created_at < datetime('now', '-7 days');
