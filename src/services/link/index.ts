import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const linkService: ServiceDefinition = {
  name: "link",
  operations,
};
