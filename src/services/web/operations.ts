/**
 * Assembles the web operations as { schema, handler } pairs. The Service Registry
 * namespaces these as `web.<name>`.
 * Phase 3: Consolidated browser, crawl, and render (screenshot) operations.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  extract: defineOperation(S.extract, H.extract),
  scrape: defineOperation(S.scrape, H.scrape),
  links: defineOperation(S.links, H.links),
  extract_structured: defineOperation(S.structured, H.extract_structured),
  snapshot: defineOperation(S.snapshot, H.snapshot),
  browser: defineOperation(S.automate, H.browser),
  map: defineOperation(S.map, H.map),
  crawl: defineOperation(S.crawl, H.crawl),
  screenshot: defineOperation(S.screenshot, H.screenshot),
};
