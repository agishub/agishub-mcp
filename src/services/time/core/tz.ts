/**
 * Core timezone math built on the runtime's Intl + Date. Pure, deterministic,
 * DST-aware, and correct for fractional offsets (India +05:30, Nepal +05:45,
 * Chatham +12:45). No native binaries, works in both Workers and Node.
 */

import ct from "countries-and-timezones";

export class TzError extends Error {}

/** True if `tz` is a valid IANA timezone name. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * All IANA timezone names, unioned from the runtime's Intl database and the
 * countries-and-timezones dataset. This matters because some runtimes list only
 * deprecated aliases (e.g. Node exposes "Asia/Calcutta" while Cloudflare Workers
 * expose "Asia/Kolkata"); we include both so lookups work everywhere.
 */
let TZ_CACHE: string[] | null = null;
export function allTimeZones(): string[] {
  if (TZ_CACHE) return TZ_CACHE;
  const set = new Set<string>();
  const fn = (Intl as any).supportedValuesOf;
  if (typeof fn === "function") for (const z of fn("timeZone") as string[]) set.add(z);
  try {
    for (const name of Object.keys(ct.getAllTimezones({ deprecated: true } as any))) set.add(name);
  } catch {
    for (const name of Object.keys(ct.getAllTimezones())) set.add(name);
  }
  TZ_CACHE = [...set].sort();
  return TZ_CACHE;
}

/** Case-insensitive substring search over IANA timezone names. */
export function searchTimeZones(query: string): string[] {
  const q = query.trim().toLowerCase();
  const all = allTimeZones();
  if (!q) return all;
  return all.filter((z) => z.toLowerCase().includes(q));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Suggest the closest valid IANA timezone(s) for an invalid input. */
export function suggestTimeZones(input: string, limit = 3): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const all = allTimeZones();
  // Prefer substring matches on the last path segment (the city).
  const partial = all.filter((z) => z.toLowerCase().includes(q));
  if (partial.length) return partial.slice(0, limit);
  // Otherwise rank by edit distance to the city component.
  return all
    .map((z) => {
      const city = z.split("/").pop()!.replace(/_/g, " ").toLowerCase();
      return { z, d: Math.min(levenshtein(q, city), levenshtein(q, z.toLowerCase())) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.z);
}

/** Throw a helpful error for an invalid timezone, suggesting alternatives. */
export function assertTimeZone(tz: string, label = "timezone"): void {
  if (isValidTimeZone(tz)) return;
  const suggestions = suggestTimeZones(tz);
  const hint = suggestions.length
    ? ` Did you mean: ${suggestions.join(", ")}?`
    : " Use an IANA name like 'Europe/Madrid' (see list_timezones).";
  throw new TzError(`Invalid ${label} "${tz}".${hint}`);
}

/**
 * Offset of `timeZone` from UTC, in minutes, at a given instant.
 * Positive = ahead of UTC. Accurate to the minute (handles :30 / :45 zones).
 */
export function tzOffsetMinutes(epochMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - epochMs) / 60000);
}

/** Format an offset in minutes as "+05:30" / "-04:00" / "+00:00". */
export function offsetToString(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Short zone abbreviation at an instant (e.g. "PST", "CEST", "GMT+5:30"). */
export function getAbbreviation(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    timeZoneName: "short",
  }).formatToParts(new Date(epochMs));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** Whether the zone is observing daylight saving time at the given instant. */
export function isDST(epochMs: number, timeZone: string): boolean {
  const year = +new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).format(new Date(epochMs));
  const jan = tzOffsetMinutes(Date.UTC(year, 0, 1), timeZone);
  const jul = tzOffsetMinutes(Date.UTC(year, 6, 1), timeZone);
  if (jan === jul) return false; // zone does not observe DST
  const cur = tzOffsetMinutes(epochMs, timeZone);
  return cur === Math.max(jan, jul);
}

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Interpret a wall-clock string ("2026-07-09 15:30" / ISO without offset) as
 * local time in `timeZone`, returning the absolute epoch ms. If the string has
 * an explicit offset (Z or ±HH:MM) it is honored and `timeZone` is ignored for
 * the instant. A second pass corrects DST boundary ambiguity.
 */
export function wallTimeToEpoch(wall: string, timeZone: string): number {
  const trimmed = wall.trim();
  // Explicit offset present -> Date can parse it directly.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const t = Date.parse(trimmed);
    if (!Number.isNaN(t)) return t;
  }
  const m = trimmed.match(WALL_RE);
  if (!m) {
    throw new TzError(
      `Unrecognized date/time "${wall}". Use ISO 8601 ("2026-07-09T15:30") or "YYYY-MM-DD HH:MM".`,
    );
  }
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const off1 = tzOffsetMinutes(guess, timeZone);
  let epoch = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(epoch, timeZone);
  if (off2 !== off1) epoch = guess - off2 * 60000;
  return epoch;
}

export interface ZonedTime {
  timezone: string;
  datetime: string; // ISO 8601 with offset, e.g. 2026-07-09T15:30:00+02:00
  date: string;
  time: string;
  weekday: string;
  utcOffset: string; // +02:00
  abbreviation: string; // CEST
  isDST: boolean;
  unix: number; // seconds
}

/** Express an instant (epoch ms) as full zoned fields in `timeZone`. */
export function formatZoned(epochMs: number, timeZone: string): ZonedTime {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const offMin = tzOffsetMinutes(epochMs, timeZone);
  const utcOffset = offsetToString(offMin);
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}:${p.second}`;
  return {
    timezone: timeZone,
    datetime: `${date}T${time}${utcOffset}`,
    date,
    time,
    weekday: p.weekday,
    utcOffset,
    abbreviation: getAbbreviation(epochMs, timeZone),
    isDST: isDST(epochMs, timeZone),
    unix: Math.floor(epochMs / 1000),
  };
}
