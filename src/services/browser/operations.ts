import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  automate: defineOperation(S.automate, H.browser_automate),
};
