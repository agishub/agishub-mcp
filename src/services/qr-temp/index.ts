import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const utilsService: ServiceDefinition = {
  name: "utils",
  operations,
};
