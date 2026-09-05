import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const timeService: ServiceDefinition = {
  name: "time",
  operations,
};
