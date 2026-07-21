import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isValidTimeZone,
  tzOffsetMinutes,
  offsetToString,
  isDST,
  wallTimeToEpoch,
  formatZoned,
  suggestTimeZones,
  searchTimeZones,
} from "../src/services/timezone/core/tz";
import { parseInZone } from "../src/services/timezone/core/parse";
import { lookupTimeZone } from "../src/services/timezone/core/lookup";
import { addToInstant, diffInstants } from "../src/services/timezone/core/datemath";
import { findMeetingSlots } from "../src/services/timezone/core/scheduler";
import { isHoliday } from "../src/services/timezone/core/holidays";

// --- Fractional offsets ------------------------------------------------------
test("India is a fixed +05:30 offset", () => {
  const e = wallTimeToEpoch("2026-07-01T12:00", "Asia/Kolkata");
  assert.equal(offsetToString(tzOffsetMinutes(e, "Asia/Kolkata")), "+05:30");
  assert.equal(tzOffsetMinutes(e, "Asia/Kolkata"), 330);
  assert.equal(isDST(e, "Asia/Kolkata"), false);
});

test("Nepal is a fixed +05:45 offset", () => {
  const e = wallTimeToEpoch("2026-01-15T09:00", "Asia/Kathmandu");
  assert.equal(offsetToString(tzOffsetMinutes(e, "Asia/Kathmandu")), "+05:45");
  assert.equal(tzOffsetMinutes(e, "Asia/Kathmandu"), 345);
});

test("Chatham Islands has a :45 offset", () => {
  const e = wallTimeToEpoch("2026-06-01T12:00", "Pacific/Chatham");
  const off = tzOffsetMinutes(e, "Pacific/Chatham");
  assert.equal(off % 60 === 45 || off % 60 === -15 || Math.abs(off % 60) === 45, true);
});

// --- DST correctness ---------------------------------------------------------
test("Madrid switches +02:00 (summer) / +01:00 (winter) with correct isDST", () => {
  const summer = wallTimeToEpoch("2026-07-01T12:00", "Europe/Madrid");
  const winter = wallTimeToEpoch("2026-01-01T12:00", "Europe/Madrid");
  assert.equal(offsetToString(tzOffsetMinutes(summer, "Europe/Madrid")), "+02:00");
  assert.equal(offsetToString(tzOffsetMinutes(winter, "Europe/Madrid")), "+01:00");
  assert.equal(isDST(summer, "Europe/Madrid"), true);
  assert.equal(isDST(winter, "Europe/Madrid"), false);
});

test("US spring-forward: 2026-03-08 02:30 America/New_York does not exist -> normalized", () => {
  // During the gap the wall time is invalid; it should still resolve sanely.
  const e = wallTimeToEpoch("2026-03-08T02:30", "America/New_York");
  const back = formatZoned(e, "America/New_York");
  // New York is either -05:00 (before) or -04:00 (after) — never crashes.
  assert.ok(["-04:00", "-05:00"].includes(back.utcOffset));
});

test("convert across DST: Madrid 15:30 (summer) -> New York 09:30", () => {
  const e = wallTimeToEpoch("2026-07-09T15:30", "Europe/Madrid");
  const ny = formatZoned(e, "America/New_York");
  assert.equal(ny.time, "09:30:00");
  assert.equal(ny.utcOffset, "-04:00");
  assert.equal(ny.isDST, true);
});

// --- Validation & suggestions ------------------------------------------------
test("invalid timezone yields close suggestions", () => {
  assert.equal(isValidTimeZone("Europe/Madridd"), false);
  const s = suggestTimeZones("Madridd");
  assert.ok(s.includes("Europe/Madrid"), `expected Europe/Madrid in ${JSON.stringify(s)}`);
});

test("searchTimeZones filters by substring", () => {
  assert.ok(searchTimeZones("kolkata").includes("Asia/Kolkata"));
});

// --- lookup_timezone ---------------------------------------------------------
test("lookup resolves Delhi -> Asia/Kolkata", () => {
  const r = lookupTimeZone("Delhi");
  assert.equal(r.matches[0].timezone, "Asia/Kolkata");
});

test("lookup resolves a country name to its zones", () => {
  const r = lookupTimeZone("Spain");
  assert.ok(r.matches.some((m) => m.timezone === "Europe/Madrid"));
});

test("lookup resolves an ISO country code", () => {
  const r = lookupTimeZone("JP");
  assert.ok(r.matches.some((m) => m.timezone === "Asia/Tokyo"));
});

// --- parse (natural language) ------------------------------------------------
test("parseInZone accepts ISO 8601", () => {
  const p = parseInZone("2026-07-09T15:30", "Europe/Madrid");
  assert.equal(p.natural, false);
  assert.equal(formatZoned(p.epochMs, "Europe/Madrid").time, "15:30:00");
});

test("parseInZone accepts natural language and returns a future instant", () => {
  const p = parseInZone("next Monday 9am", "America/New_York");
  assert.equal(p.natural, true);
  assert.ok(p.epochMs > Date.now());
  assert.equal(formatZoned(p.epochMs, "America/New_York").time.slice(0, 5), "09:00");
});

// --- date_math ---------------------------------------------------------------
test("adding 1 day keeps local wall-clock across a DST boundary", () => {
  // EU DST ends 2026-10-25; +1 day from the 24th stays 12:00 local though the
  // absolute gap is 25 hours.
  const start = wallTimeToEpoch("2026-10-24T12:00", "Europe/Madrid");
  const next = addToInstant(start, "Europe/Madrid", 1, "days");
  const z = formatZoned(next, "Europe/Madrid");
  assert.equal(z.date, "2026-10-25");
  assert.equal(z.time, "12:00:00");
  assert.equal((next - start) / 3600000, 25); // absolute elapsed = 25h
});

test("adding hours is absolute (shifts wall clock across DST)", () => {
  const start = wallTimeToEpoch("2026-10-25T01:30", "Europe/Madrid"); // just before fall-back
  const later = addToInstant(start, "Europe/Madrid", 2, "hours");
  assert.equal((later - start) / 3600000, 2);
});

test("diffInstants computes signed cross-zone difference", () => {
  const a = wallTimeToEpoch("2026-07-09T09:00", "America/New_York"); // 13:00Z
  const b = wallTimeToEpoch("2026-07-09T15:30", "Europe/Madrid"); // 13:30Z
  const d = diffInstants(a, "America/New_York", b, "Europe/Madrid");
  assert.equal(d.total_minutes, 30);
});

// --- find_meeting_slots ------------------------------------------------------
test("find_meeting_slots returns overlap within both working windows", async () => {
  const res = await findMeetingSlots(
    [
      { timezone: "Europe/Madrid", working_hours: { start: "09:00", end: "17:00" } },
      { timezone: "America/New_York", working_hours: { start: "09:00", end: "17:00" } },
    ],
    60,
    { start: "2026-07-13", end: "2026-07-17" }, // Mon–Fri
    5,
  );
  assert.ok(res.slots.length > 0, "expected at least one overlapping slot");
  for (const slot of res.slots) {
    // Madrid 15:00–17:00 overlaps NY 09:00–11:00; every slot must sit in-hours.
    for (const p of slot.participants) {
      const hh = Number(p.local_start.slice(11, 13));
      assert.ok(hh >= 9 && hh < 17, `slot out of hours: ${JSON.stringify(p)}`);
    }
  }
});

test("find_meeting_slots skips weekends", async () => {
  const res = await findMeetingSlots(
    [{ timezone: "Europe/Madrid" }],
    30,
    { start: "2026-07-11", end: "2026-07-12" }, // Sat–Sun
    5,
  );
  assert.equal(res.slots.length, 0);
});

// --- is_holiday (network: Nager.Date) ---------------------------------------
test("is_holiday detects US New Year's Day", async () => {
  const r = await isHoliday("2026-01-01", "US");
  assert.equal(r.isHoliday, true);
  assert.match(r.holiday?.name ?? "", /New Year/i);
});

test("is_holiday returns false for an ordinary day", async () => {
  const r = await isHoliday("2026-07-07", "US");
  assert.equal(r.isHoliday, false);
});
