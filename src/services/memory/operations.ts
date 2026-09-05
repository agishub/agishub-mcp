import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  store: defineOperation(S.memoryUpsert, H.memory_upsert),
  search: defineOperation(S.memorySearch, H.memory_search),
};
