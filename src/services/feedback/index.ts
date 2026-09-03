import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const feedbackService: ServiceDefinition = {
  name: "feedback",
  operations,
};
