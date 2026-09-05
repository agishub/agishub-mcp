import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const urlService: ServiceDefinition = {
  name: "url",
  operations,
};
