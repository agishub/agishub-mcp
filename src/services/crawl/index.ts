import type { ServiceDefinition } from "../types";
import { operations } from "./operations";

export const crawlService: ServiceDefinition = {
  name: "crawl",
  operations,
};
