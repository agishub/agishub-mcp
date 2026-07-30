import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const ragService: ServiceDefinition = {
  name: "rag",
  operations,
};
