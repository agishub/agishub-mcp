import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const marketService: ServiceDefinition = {
  name: "market",
  operations,
};
