import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  chat: defineOperation(S.chat, H.chat),
  classify: defineOperation(S.classify, H.classify),
  embed: defineOperation(S.embed, H.embed),
  extract: defineOperation(S.extractEntities, H.extract_entities),
  summarize: defineOperation(S.summarize, H.summarize),
};
