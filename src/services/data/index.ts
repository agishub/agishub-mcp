import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const dataService: ServiceDefinition = {
  name: "data",
  operations,
};
