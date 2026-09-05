/**
 * Parse a datetime that may be ISO 8601 OR natural language ("next Tuesday 3pm",
 * "tomorrow 09:00", "in 2 hours"). Natural-language expressions are resolved
 * relative to the *current* wall-clock time in the target `timeZone`, then
 * pinned to that zone so DST is applied correctly.
 */

import * as chrono from "chrono-node";
import { wallTimeToEpoch, TzError } from "./tz";

const ISO_LIKE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)?\s*(?:[zZ]|[+-]\d{2}:?\d{2})?$/;

/** Current wall-clock components in `timeZone`, as a UTC-keyed reference Date. */
function referenceDate(timeZone: string): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return new Date(
    Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface ParsedDate {
  epochMs: number;
  /** How the input was understood, echoed back for transparency. */
  interpreted: string;
  natural: boolean;
}

/** Parse `input` as a datetime interpreted in `timeZone`. */
export function parseInZone(input: string, timeZone: string): ParsedDate {
  const trimmed = input.trim();
  if (!trimmed) throw new TzError("Empty datetime.");

  // Fast path: ISO 8601 / plain wall clock (deterministic).
  if (ISO_LIKE.test(trimmed)) {
    return {
      epochMs: wallTimeToEpoch(trimmed, timeZone),
      interpreted: trimmed,
      natural: false,
    };
  }

  // Natural language via chrono, anchored to "now" in the target zone.
  const ref = referenceDate(timeZone);
  const results = chrono.parse(trimmed, ref, { forwardDate: true });
  if (!results.length) {
    throw new TzError(
      `Could not understand the date/time "${input}". Try ISO 8601 (e.g. ` +
        `"2026-07-09T15:30") or plain language ("next Tuesday 3pm").`,
    );
  }
  const start = results[0].start;
  const y = start.get("year")!;
  const mo = start.get("month")!;
  const d = start.get("day")!;
  const h = start.isCertain("hour") ? start.get("hour")! : 0;
  const mi = start.isCertain("minute") ? start.get("minute")! : 0;
  const s = start.isCertain("second") ? start.get("second")! : 0;
  const wall = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
  return {
    epochMs: wallTimeToEpoch(wall, timeZone),
    interpreted: results[0].text,
    natural: true,
  };
}
