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
      type: z.enum(["add", "diff"]).describe("'add' to shift the datetime by a duration, or 'diff' to measure the gap between two datetimes."),
      amount: z.number().optional().describe("For type 'add': how much to shift. Use a negative number to subtract."),
      unit: z.enum(UNITS).optional().describe("For type 'add': one of seconds, minutes, hours, days, weeks."),
      to_datetime: z.string().optional().describe("For type 'diff': the second datetime (ISO 8601 or natural language)."),
      to_timezone: z.string().optional().describe("For type 'diff': the IANA timezone of to_datetime (defaults to the base timezone)."),
    })
    .describe("What to compute: { type:'add', amount, unit } to add/subtract a duration, or { type:'diff', to_datetime, to_timezone? } for the difference between two datetimes."),
});

export const findMeetingSlots = z.object({
  participants: z
    .array(
      z.object({
        timezone: z.string().describe("Participant's IANA timezone, e.g. 'Europe/Madrid'."),
        working_hours: z
          .object({
            start: z.string().describe('Local start time "HH:mm" (24h), e.g. "09:00".'),
            end: z.string().describe('Local end time "HH:mm" (24h), e.g. "17:00".'),
          })
          .optional()
          .describe('This participant\'s local working hours. Defaults to 09:00-17:00.'),
        country: z.string().optional().describe("ISO 3166-1 alpha-2 code (e.g. 'US', 'ES') to exclude that person's public holidays."),
      }),
    )
    .min(1)
    .describe('The people to meet. Each participant is { timezone (IANA, required), working_hours? { start, end }, country? (ISO alpha-2) }.'),
  duration: z.number().describe("Meeting duration in minutes."),
  date_range: z
    .object({
      start: z.string().describe('First date to search "YYYY-MM-DD".'),
      end: z.string().describe('Last date to search "YYYY-MM-DD".'),
    })
    .describe('Inclusive date window to search, e.g. { "start":"2026-07-13", "end":"2026-07-17" }.'),
});

export const isHoliday = z.object({
  date: z.string().describe('Date "YYYY-MM-DD".'),
  country_code: z.string().describe('ISO country code, e.g. "US", "ES", "IN".'),
});
