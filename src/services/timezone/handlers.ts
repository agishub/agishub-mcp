/**
 * Pure handlers for the timezone service. Each receives an OperationContext with
 * validated `input` and returns plain JSON (the MCP adapter wraps it as a tool
 * result; the HTTP adapter returns it directly). No transport, price or auth
 * concerns here — just business logic over ./core/*.
 */

import {
  formatZoned,
  assertTimeZone,
  searchTimeZones,
  tzOffsetMinutes,
  offsetToString,
  getAbbreviation,
  isDST,
  TzError,
} from "./core/tz";
import { parseInZone } from "./core/parse";
import { lookupTimeZone } from "./core/lookup";
import { addToInstant, diffInstants, type Unit } from "./core/datemath";
import { findMeetingSlots as findSlots, type Participant, type DateRange } from "./core/scheduler";
import { isHoliday as isHolidayCore } from "./core/holidays";
import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";

export function nowIn(ctx: OperationContext<z.infer<typeof S.nowIn>>) {
  const { timezone } = ctx.input;
  assertTimeZone(timezone);
  return formatZoned(Date.now(), timezone);
}

export function convertTimezone(ctx: OperationContext<z.infer<typeof S.convertTimezone>>) {
  const { datetime, from, to } = ctx.input;
  assertTimeZone(from, "from timezone");
  assertTimeZone(to, "to timezone");
  const parsed = parseInZone(datetime, from);
  return {
    input: datetime,
    interpreted_as: parsed.interpreted,
    natural_language: parsed.natural,
    from: formatZoned(parsed.epochMs, from),
    to: formatZoned(parsed.epochMs, to),
  };
}

export function convertBatch(ctx: OperationContext<z.infer<typeof S.convertBatch>>) {
  const { datetime, from, to } = ctx.input;
  assertTimeZone(from, "from timezone");
  to.forEach((t) => assertTimeZone(t, "target timezone"));
  const parsed = parseInZone(datetime, from);
  return {
    input: datetime,
    interpreted_as: parsed.interpreted,
    from: formatZoned(parsed.epochMs, from),
    conversions: to.map((t) => formatZoned(parsed.epochMs, t)),
  };
}

export function tzOffset(ctx: OperationContext<z.infer<typeof S.tzOffset>>) {
  const { timezone, instant } = ctx.input;
  assertTimeZone(timezone);
  const epoch = instant ? parseInZone(instant, timezone).epochMs : Date.now();
  const offMin = tzOffsetMinutes(epoch, timezone);
  return {
    timezone,
    instant: formatZoned(epoch, timezone).datetime,
    utcOffset: offsetToString(offMin),
    offsetMinutes: offMin,
    abbreviation: getAbbreviation(epoch, timezone),
    isDST: isDST(epoch, timezone),
  };
}

export function listTimezones(ctx: OperationContext<z.infer<typeof S.listTimezones>>) {
  const all = searchTimeZones(ctx.input.query ?? "");
  return { count: all.length, returned: Math.min(all.length, 300), timezones: all.slice(0, 300) };
}

export function lookupTimezone(ctx: OperationContext<z.infer<typeof S.lookupTimezone>>) {
  const { query, matches } = lookupTimeZone(ctx.input.city_or_country);
  return {
    query,
    matches: matches.map((m) => ({ ...m, now: formatZoned(Date.now(), m.timezone) })),
  };
}

export function dateMath(ctx: OperationContext<z.infer<typeof S.dateMath>>) {
  const { datetime, timezone, operation } = ctx.input;
  assertTimeZone(timezone);
  const base = parseInZone(datetime, timezone);
  if (operation.type === "add") {
    if (operation.amount === undefined || !operation.unit) {
      throw new TzError("operation.add requires 'amount' and 'unit'.");
    }
    const result = addToInstant(base.epochMs, timezone, operation.amount, operation.unit as Unit);
    return {
      input: formatZoned(base.epochMs, timezone),
      operation: `${operation.amount >= 0 ? "+" : ""}${operation.amount} ${operation.unit}`,
      result: formatZoned(result, timezone),
    };
  }
  if (!operation.to_datetime) throw new TzError("operation.diff requires 'to_datetime'.");
  const toTz = operation.to_timezone ?? timezone;
  assertTimeZone(toTz, "to_timezone");
  const other = parseInZone(operation.to_datetime, toTz);
  return diffInstants(base.epochMs, timezone, other.epochMs, toTz);
}

export function findMeetingSlots(ctx: OperationContext<z.infer<typeof S.findMeetingSlots>>) {
  const { participants, duration, date_range } = ctx.input;
  return findSlots(participants as Participant[], duration, date_range as DateRange, 8);
}

export function isHoliday(ctx: OperationContext<z.infer<typeof S.isHoliday>>) {
  return isHolidayCore(ctx.input.date, ctx.input.country_code);
}
