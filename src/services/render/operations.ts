import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  pdf: defineOperation(S.pdf, H.pdf),
  screenshot: defineOperation(S.screenshot, H.screenshot),
};
