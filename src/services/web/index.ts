import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const webService: ServiceDefinition = {
  name: "web",
  operations,
};
