import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  summarize: defineOperation(S.summarize, H.summarize),
  classify: defineOperation(S.classify, H.classify),
  extract_entities: defineOperation(S.extractEntities, H.extract_entities),
  transcribe: defineOperation(S.transcribe, H.transcribe),
  ocr: defineOperation(S.ocr, H.ocr),
  embed: defineOperation(S.embed, H.embed),
  chat: defineOperation(S.chat, H.chat),
  tts: defineOperation(S.tts, H.tts),
};
