import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  convert_currency: defineOperation(S.convertCurrency, H.convert_currency),
};
