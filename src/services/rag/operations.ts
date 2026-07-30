import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  memory_upsert: defineOperation(S.memoryUpsert, H.memory_upsert),
  memory_search: defineOperation(S.memorySearch, H.memory_search),
};
