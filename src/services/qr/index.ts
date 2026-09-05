import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const qrService: ServiceDefinition = {
  name: "qr",
  operations,
};
