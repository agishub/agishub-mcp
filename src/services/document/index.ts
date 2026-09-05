import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const documentService: ServiceDefinition = {
  name: "document",
  operations,
};
