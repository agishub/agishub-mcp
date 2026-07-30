import { z } from "zod";

export const relay = z.object({
  url: z.string().url().describe("Public http/https URL to deliver the webhook to."),
  payload: z.unknown().describe("JSON body to POST to the target (object, array, string or number)."),
  method: z.enum(["POST", "PUT", "PATCH"]).optional().describe("HTTP method (default POST)."),
  headers: z.record(z.string()).optional().describe("Optional extra request headers, e.g. an auth token."),
});

export const status = z.object({
  job_id: z.string().describe("The job_id returned by webhook_relay."),
});
