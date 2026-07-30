import { defineOperation } from "../types";
import * as S from "./schemas";
import * as H from "./handlers";

export const operations = {
  price: defineOperation(S.price, H.price),
};
