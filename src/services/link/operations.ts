import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  shorten: defineOperation(S.shorten, H.shorten),
};
