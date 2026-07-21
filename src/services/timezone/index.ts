import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const timezoneService: ServiceDefinition = {
  name: "timezone",
  operations,
};
