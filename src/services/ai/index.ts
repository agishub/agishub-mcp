import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const aiService: ServiceDefinition = {
  name: "ai",
  operations,
};
