import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const browserService: ServiceDefinition = {
  name: "browser",
  operations,
};
