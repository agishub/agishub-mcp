import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const imageService: ServiceDefinition = {
  name: "image",
  operations,
};
