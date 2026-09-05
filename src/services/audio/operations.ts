import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  transcribe: defineOperation(S.transcribe, H.transcribe),
  speak: defineOperation(S.tts, H.speak),
};
