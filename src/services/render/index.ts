import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const renderService: ServiceDefinition = {
  name: "render",
  operations,
};
