/**
 * Zod input schemas for the timezone service — the single source of validation.
 * The MCP adapter passes `.shape` to server.tool(); the HTTP adapter uses
 * `.parse()` and derives the OpenAPI JSON Schema. Descriptions are surfaced to
 * MCP clients, so keep them identical to the published tool schemas.
 */

import { z } from "zod";

const UNITS = ["seconds", "minutes", "hours", "days", "weeks"] as const;

export const nowIn = z.object({
  timezone: z.string().describe("IANA timezone, e.g. 'Europe/Madrid', 'Asia/Kolkata'."),
});

export const convertTimezone = z.object({
  datetime: z.string().describe('ISO 8601 or natural language, e.g. "2026-07-09T15:30" or "next Tuesday 3pm".'),
  from: z.string().describe("Source IANA timezone."),
  to: z.string().describe("Target IANA timezone."),
});

export const convertBatch = z.object({
  datetime: z.string().describe("ISO 8601 or natural language."),
  from: z.string().describe("Source IANA timezone."),
  to: z.array(z.string()).min(1).describe("List of target IANA timezones."),
});

export const tzOffset = z.object({
  timezone: z.string().describe("IANA timezone."),
  instant: z.string().optional().describe("ISO 8601 or natural language. Defaults to now."),
});

export const listTimezones = z.object({
  query: z.string().optional().describe("Case-insensitive substring filter."),
});

export const lookupTimezone = z.object({
  city_or_country: z.string().describe("City or country name, or ISO country code."),
});

export const dateMath = z.object({
  datetime: z.string().describe("Base datetime: ISO 8601 or natural language."),
  timezone: z.string().describe("IANA timezone the base datetime is in."),
  operation: z
    .object({
      type: z.enum(["add", "diff"]),
      amount: z.number().optional().describe("For 'add': amount to add (negative subtracts)."),
      unit: z.enum(UNITS).optional().describe("For 'add': seconds|minutes|hours|days|weeks."),
      to_datetime: z.string().optional().describe("For 'diff': the other datetime."),
      to_timezone: z.string().optional().describe("For 'diff': timezone of to_datetime (defaults to timezone)."),
    })
    .describe("Operation to perform."),
});

export const findMeetingSlots = z.object({
  participants: z
    .array(
      z.object({
        timezone: z.string().describe("Participant IANA timezone."),
        working_hours: z
          .object({ start: z.string(), end: z.string() })
          .optional()
          .describe('Local working hours, e.g. {"start":"09:00","end":"17:00"}. Defaults 09:00-17:00.'),
        country: z.string().optional().describe("ISO 3166-1 alpha-2 to skip that person's holidays."),
      }),
    )
    .min(1),
  duration: z.number().describe("Meeting duration in minutes."),
  date_range: z
    .object({ start: z.string(), end: z.string() })
    .describe('Search window, e.g. {"start":"2026-07-13","end":"2026-07-17"}.'),
});

export const isHoliday = z.object({
  date: z.string().describe('Date "YYYY-MM-DD".'),
  country_code: z.string().describe('ISO country code, e.g. "US", "ES", "IN".'),
});
