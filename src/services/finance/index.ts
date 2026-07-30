import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const financeService: ServiceDefinition = {
  name: "finance",
  operations,
};
