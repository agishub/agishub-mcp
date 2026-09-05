import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  currency_convert: defineOperation(S.convertCurrency, H.currency_convert),
  convert_units: defineOperation(S.convertUnits, H.convert_units),
};
