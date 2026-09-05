/**
 * Public-holiday lookup via the free, no-key Nager.Date API
 * (https://date.nager.at). Results are cached per (year, country) in isolate
 * memory to minimize outbound calls. This is the only tool that touches the
 * network; everything else is pure/offline.
 */

import { TzError } from "./tz";

export interface Holiday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
}

const cache = new Map<string, Holiday[]>();

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

async function fetchYear(year: string, country: string): Promise<Holiday[]> {
  const key = `${year}:${country}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    { headers: { accept: "application/json" } },
  );
  if (res.status === 404) {
    throw new TzError(`Unknown country code "${country}" (use ISO 3166-1 alpha-2, e.g. "US").`);
  }
  if (!res.ok) {
    throw new TzError(`Holiday lookup failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as Array<{ date: string; localName: string; name: string }>;
  const list = data.map((h) => ({ date: h.date, localName: h.localName, name: h.name }));
  cache.set(key, list);
  return list;
}

export interface HolidayResult {
  date: string;
  countryCode: string;
  isHoliday: boolean;
  holiday: Holiday | null;
}

/** Is `date` (YYYY-MM-DD) a public holiday in `countryCode` (ISO alpha-2)? */
export async function isHoliday(date: string, countryCode: string): Promise<HolidayResult> {
  const m = date.trim().match(DATE_RE);
  if (!m) throw new TzError(`Date must be "YYYY-MM-DD", got "${date}".`);
  const country = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new TzError(`Country code must be ISO 3166-1 alpha-2, got "${countryCode}".`);
  }
  const list = await fetchYear(m[1], country);
  const hit = list.find((h) => h.date === date.trim()) ?? null;
  return { date: date.trim(), countryCode: country, isHoliday: !!hit, holiday: hit };
}

/** Best-effort holiday check for the scheduler: never throws (false on error). */
export async function isHolidaySafe(date: string, countryCode: string): Promise<boolean> {
  try {
    return (await isHoliday(date, countryCode)).isHoliday;
  } catch {
    return false;
  }
}
