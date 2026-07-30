import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const cryptoService: ServiceDefinition = {
  name: "crypto",
  operations,
};
