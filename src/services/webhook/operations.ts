import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  relay: defineOperation(S.relay, H.webhook_relay),
  status: defineOperation(S.status, H.webhook_status),
};
