/**
 * Assembles the web operations as { schema, handler } pairs. The Service Registry
 * namespaces these as `web.<name>`.
 */

import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  extract: defineOperation(S.extract, H.extract),
};
