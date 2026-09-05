/**
 * Web search via SearXNG (public instance) or jina.ai.
 * Fast, free, and no API key required.
 */

const SEARXNG_INSTANCES = [
  "https://searxng.org",
  "https://search.bebb.dev",
  "https://search.lossless.digital",
];

const JINA_SEARCH_API = "https://jina.ai/api/search";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
  engine?: string;
}

class SearchError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

/**
 * Try Jina.ai search API first (fastest, most reliable for AI workloads).
 */
async function searchViaJina(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${JINA_SEARCH_API}?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 10)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; agishub-websearch/1.0; +https://api.agishub.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Jina API returned ${response.status}`);

    const data = (await response.json()) as any;
    const results = (data.data || []).map((item: any) => ({
      title: item.title || "Untitled",
      url: item.url || "",
      snippet: item.snippet || item.description || "",
      source: "jina",
      date: item.date,
    }));

    return results;
  } catch (err) {
    throw new SearchError("JINA_FAILED", `Jina search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Fallback: SearXNG public instance (self-hosted open-source metasearch).
 */
async function searchViaSearxng(query: string, limit: number): Promise<SearchResult[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = new URL(`${instance}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("results", Math.min(limit, 50).toString());

      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; agishub-websearch/1.0; +https://api.agishub.com)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) throw new Error(`SearXNG returned ${response.status}`);

      const data = (await response.json()) as any;
      const results = (data.results || []).map((item: any) => ({
        title: item.title || "Untitled",
        url: item.url || "",
        snippet: item.content || item.description || "",
        source: "searxng",
        date: item.pubdate,
      }));

      return results.slice(0, limit);
    } catch (err) {
      // Try next instance
      continue;
    }
  }

  throw new SearchError("SEARXNG_FAILED", "All SearXNG instances failed");
}

/**
 * Web search: tries Jina first, falls back to SearXNG.
 */
export async function search(query: string, limit: number = 10): Promise<SearchResponse> {
  if (!query || query.trim().length === 0) {
    throw new SearchError("INVALID_QUERY", "Query cannot be empty");
  }

  const safeLimits = Math.max(1, Math.min(limit, 20));
  let results: SearchResult[] = [];
  let engine = "unknown";

  // Try Jina first
  try {
    results = await searchViaJina(query.trim(), safeLimits);
    engine = "jina";
  } catch (err) {
    if (err instanceof SearchError && err.code === "JINA_FAILED") {
      // Fallback to SearXNG
      try {
        results = await searchViaSearxng(query.trim(), safeLimits);
        engine = "searxng";
      } catch (fallbackErr) {
        throw new SearchError(
          "ALL_ENGINES_FAILED",
          `All search engines failed: Jina and SearXNG both returned errors`,
        );
      }
    } else {
      throw err;
    }
  }

  return {
    query: query.trim(),
    results: results.slice(0, safeLimits),
    count: results.length,
    engine,
  };
}
