import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  qr_code: defineOperation(S.qrCode, H.qr_code),
  convert_units: defineOperation(S.convertUnits, H.convert_units),
};
