import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  request_feature: defineOperation(S.request_feature, H.feedback_request_feature),
};
