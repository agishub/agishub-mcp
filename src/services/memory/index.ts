import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const memoryService: ServiceDefinition = {
  name: "memory",
  operations,
};
