/**
 * Map core: discover all URLs on a website.
 * Strategy:
 * 1. Try to fetch sitemap.xml (fastest if available)
 * 2. If not found, use Browser Rendering to crawl home page + BFS 1 level
 * 3. Deduplicate, filter by domain/subdomains, apply regex filter
 */

import type { Env } from "../../../types";

interface MapInput {
  url: string;
  limit: number;
  include_subdomains: boolean;
  search?: string;
}

interface MapResult {
  urls: string[];
  metadata: {
    source: "sitemap" | "browser";
    fetched_at: string;
    robots_txt_delay_ms?: number;
  };
}

export async function mapCore(input: MapInput, env: Env): Promise<MapResult> {
  const { url, limit, include_subdomains, search } = input;
  const rootUrl = new URL(url);
  const domain = rootUrl.hostname;

  const urls = new Set<string>();

  // ── Try sitemap.xml first (fastest) ────────────────────────────────────────
  try {
    const sitemapUrl = `${rootUrl.protocol}//${rootUrl.host}/sitemap.xml`;
    const response = await fetch(sitemapUrl, { cf: { cacheTtl: 3600 } });
    if (response.ok) {
      const text = await response.text();
      const urlSet = text.match(/<loc>(.+?)<\/loc>/g);
      if (urlSet) {
        for (const entry of urlSet) {
          const match = entry.match(/<loc>(.+?)<\/loc>/);
          if (match) {
            const candidate = match[1];
            if (shouldIncludeUrl(candidate, domain, include_subdomains)) {
              urls.add(candidate);
            }
          }
        }
      }
      return {
        urls: Array.from(urls)
          .filter(u => !search || new RegExp(search, "i").test(u))
          .slice(0, limit),
        metadata: {
          source: "sitemap",
          fetched_at: new Date().toISOString(),
        },
      };
    }
  } catch (e) {
    // Sitemap not available, fall back to browser
  }

  // ── Fallback: Browser Rendering + BFS 1 level ──────────────────────────────
  try {
    const response = await (env.BROWSER as any)?.render(rootUrl.toString(), {
      timeout: 15000,
    });

    if (response?.html) {
      const linkRegex = /href=["']([^"']+)["']/gi;
      let match;
      const visited = new Set<string>();

      while ((match = linkRegex.exec(response.html)) !== null) {
        const href = match[1];
        if (href.startsWith("http")) {
          try {
            const linkUrl = new URL(href);
            if (shouldIncludeUrl(href, domain, include_subdomains) && !visited.has(href)) {
              urls.add(href);
              visited.add(href);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }

      // Always include root
      urls.add(rootUrl.toString());
    }
  } catch (e) {
    console.error("Browser render failed:", e);
  }

  return {
    urls: Array.from(urls)
      .filter(u => !search || new RegExp(search, "i").test(u))
      .sort()
      .slice(0, limit),
    metadata: {
      source: "browser",
      fetched_at: new Date().toISOString(),
    },
  };
}

function shouldIncludeUrl(url: string, domain: string, includeSubdomains: boolean): boolean {
  try {
    const parsed = new URL(url);
    if (includeSubdomains) {
      return parsed.hostname.endsWith(domain);
    } else {
      return parsed.hostname === domain;
    }
  } catch {
    return false;
  }
}
