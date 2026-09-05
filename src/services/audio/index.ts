import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const audioService: ServiceDefinition = {
  name: "audio",
  operations,
};
