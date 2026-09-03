/**
 * Assembles the crawl operations as { schema, handler } pairs.
 * Service Registry namespaces these as `crawl.<name>`.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  map: defineOperation(S.map, H.map),
  crawl: defineOperation(S.crawl, H.crawl),
  crawl_status: defineOperation(S.crawlStatus, H.crawlStatus),
};
