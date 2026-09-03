/**
 * Assembles the web operations as { schema, handler } pairs. The Service Registry
 * namespaces these as `web.<name>`.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  extract: defineOperation(S.extract, H.extract),
  scrape: defineOperation(S.scrape, H.scrape),
  links: defineOperation(S.links, H.links),
  structured: defineOperation(S.structured, H.structured),
  snapshot: defineOperation(S.snapshot, H.snapshot),
};
