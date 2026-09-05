/**
 * Resolve a human place name (city or country) to an IANA timezone, so callers
 * never need to know the exact identifier. Backed by countries-and-timezones
 * (offline dataset) plus a small alias table for popular cities whose IANA zone
 * is named after a different city (e.g. Delhi -> Asia/Kolkata).
 */

import ct from "countries-and-timezones";
import { allTimeZones, TzError, suggestTimeZones } from "./tz";

/** Popular city / country aliases -> canonical IANA zone. */
const ALIASES: Record<string, string> = {
  delhi: "Asia/Kolkata",
  "new delhi": "Asia/Kolkata",
  mumbai: "Asia/Kolkata",
  bangalore: "Asia/Kolkata",
  bengaluru: "Asia/Kolkata",
  kathmandu: "Asia/Kathmandu",
  beijing: "Asia/Shanghai",
  shanghai: "Asia/Shanghai",
  "hong kong": "Asia/Hong_Kong",
  tokyo: "Asia/Tokyo",
  seoul: "Asia/Seoul",
  singapore: "Asia/Singapore",
  dubai: "Asia/Dubai",
  "abu dhabi": "Asia/Dubai",
  moscow: "Europe/Moscow",
  london: "Europe/London",
  paris: "Europe/Paris",
  madrid: "Europe/Madrid",
  barcelona: "Europe/Madrid",
  berlin: "Europe/Berlin",
  rome: "Europe/Rome",
  "new york": "America/New_York",
  nyc: "America/New_York",
  "los angeles": "America/Los_Angeles",
  la: "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  chicago: "America/Chicago",
  toronto: "America/Toronto",
  "mexico city": "America/Mexico_City",
  "sao paulo": "America/Sao_Paulo",
  "buenos aires": "America/Argentina/Buenos_Aires",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  auckland: "Pacific/Auckland",
};

export interface TzMatch {
  timezone: string;
  country: string | null;
  countryCode: string | null;
  utcOffset: string;
}

function toMatch(name: string): TzMatch | null {
  const tz = ct.getTimezone(name);
  if (!tz) return null;
  const country = tz.countries?.[0] ? ct.getCountry(tz.countries[0]) : null;
  return {
    timezone: tz.aliasOf ?? tz.name,
    country: country?.name ?? null,
    countryCode: country?.id ?? null,
    utcOffset: tz.utcOffsetStr,
  };
}

/** Resolve a city or country name to one or more IANA timezones. */
export function lookupTimeZone(input: string): { query: string; matches: TzMatch[] } {
  const raw = input.trim();
  const q = raw.toLowerCase();
  if (!q) throw new TzError("Provide a city or country name.");

  const out: TzMatch[] = [];
  const push = (name: string) => {
    const m = toMatch(name);
    if (m && !out.some((o) => o.timezone === m.timezone)) out.push(m);
  };

  // 1) Alias table (fast path for well-known cities).
  if (ALIASES[q]) push(ALIASES[q]);

  // 2) ISO country code.
  if (out.length === 0 && /^[a-z]{2}$/.test(q)) {
    const country = ct.getCountry(q.toUpperCase() as any);
    country?.timezones?.forEach(push);
  }

  // 3) Country by name.
  if (out.length === 0) {
    const countries = ct.getAllCountries();
    for (const country of Object.values(countries)) {
      if (country.name.toLowerCase() === q) {
        country.timezones.forEach(push);
        break;
      }
    }
  }

  // 4) City: match the last path segment of any IANA zone.
  if (out.length === 0) {
    const city = q.replace(/\s+/g, "_");
    for (const z of allTimeZones()) {
      const seg = z.split("/").pop()!.toLowerCase();
      if (seg === city) push(z);
    }
  }

  // 5) Loose city contains.
  if (out.length === 0) {
    const city = q.replace(/\s+/g, "_");
    for (const z of allTimeZones()) {
      if (z.split("/").pop()!.toLowerCase().includes(city)) push(z);
    }
  }

  if (out.length === 0) {
    const suggestions = suggestTimeZones(raw);
    const hint = suggestions.length ? ` Closest IANA zones: ${suggestions.join(", ")}.` : "";
    throw new TzError(`Could not resolve "${input}" to a timezone.${hint}`);
  }
  return { query: raw, matches: out };
}
