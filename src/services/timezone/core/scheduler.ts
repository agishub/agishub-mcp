/**
 * find_meeting_slots — suggest overlapping working-hour slots for people across
 * timezones. Scans absolute time in 30-minute steps and keeps slots where every
 * participant is within their local working hours on a working day (weekends and,
 * optionally, public holidays excluded).
 */

import { formatZoned, assertTimeZone, TzError } from "./tz";
import { isHolidaySafe } from "./holidays";

export interface WorkingHours {
  start: string; // "HH:MM" local
  end: string; // "HH:MM" local
}

export interface Participant {
  timezone: string;
  working_hours?: WorkingHours;
  /** Optional ISO 3166-1 alpha-2 code to skip that participant's public holidays. */
  country?: string;
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^(\d{1,2}):(\d{2})$/;
const STEP_MIN = 30;

function parseHM(hm: string, fallback: number): number {
  const m = hm?.match(HM_RE);
  if (!m) return fallback;
  return +m[1] * 60 + +m[2];
}

interface LocalInfo {
  date: string;
  minutes: number; // minutes since local midnight
  dow: number; // 0 Sun .. 6 Sat
}

function localInfo(epochMs: number, tz: string): LocalInfo {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(epochMs))
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const dow = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay();
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: +p.hour * 60 + +p.minute,
    dow,
  };
}

export interface MeetingSlot {
  start_utc: string;
  end_utc: string;
  participants: Array<{
    timezone: string;
    local_start: string;
    local_end: string;
    weekday: string;
  }>;
}

export interface MeetingResult {
  duration_minutes: number;
  date_range: DateRange;
  participants: Array<{ timezone: string; working_hours: WorkingHours }>;
  slots: MeetingSlot[];
  count: number;
  note?: string;
}

export async function findMeetingSlots(
  participants: Participant[],
  durationMinutes: number,
  dateRange: DateRange,
  limit = 8,
): Promise<MeetingResult> {
  if (!participants?.length) throw new TzError("At least one participant is required.");
  if (!(durationMinutes > 0)) throw new TzError("duration must be a positive number of minutes.");
  if (!DATE_RE.test(dateRange.start) || !DATE_RE.test(dateRange.end)) {
    throw new TzError('date_range.start and date_range.end must be "YYYY-MM-DD".');
  }

  const parts = participants.map((p) => {
    assertTimeZone(p.timezone, "participant timezone");
    const start = p.working_hours?.start ?? "09:00";
    const end = p.working_hours?.end ?? "17:00";
    const startMin = parseHM(start, 540);
    const endMin = parseHM(end, 1020);
    if (endMin <= startMin) {
      throw new TzError(`Working hours for ${p.timezone} must have end after start.`);
    }
    return { ...p, wh: { start, end }, startMin, endMin };
  });

  // Pre-compute holiday sets for participants that provided a country code, by
  // checking each unique (participant, date) once (isHolidaySafe caches by year).
  const holidaySets = new Map<number, Set<string>>();
  parts.forEach((p, i) => {
    if (p.country) holidaySets.set(i, new Set<string>());
  });
  const rangeDates = enumerateDates(dateRange.start, dateRange.end);
  await Promise.all(
    parts.flatMap((p, i) =>
      p.country
        ? rangeDates.map(async (d) => {
            if (await isHolidaySafe(d, p.country!)) holidaySets.get(i)!.add(d);
          })
        : [],
    ),
  );

  const scanStart = Date.parse(`${dateRange.start}T00:00:00Z`) - 14 * 3600000;
  const scanEnd = Date.parse(`${dateRange.end}T00:00:00Z`) + 38 * 3600000;
  const durMs = durationMinutes * 60000;

  const slots: MeetingSlot[] = [];
  for (let t = ceilTo(scanStart, STEP_MIN); t <= scanEnd && slots.length < limit; t += STEP_MIN * 60000) {
    const endT = t + durMs;
    let ok = true;
    const perParticipant: MeetingSlot["participants"] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const a = localInfo(t, p.timezone);
      const b = localInfo(endT - 1, p.timezone);
      const withinRange = a.date >= dateRange.start && a.date <= dateRange.end;
      const weekday = a.dow !== 0 && a.dow !== 6;
      const sameDay = a.date === b.date;
      const inHours = a.minutes >= p.startMin && b.minutes + 1 <= p.endMin;
      const notHoliday = !holidaySets.get(i)?.has(a.date);
      if (!(withinRange && weekday && sameDay && inHours && notHoliday)) {
        ok = false;
        break;
      }
      const zs = formatZoned(t, p.timezone);
      const ze = formatZoned(endT, p.timezone);
      perParticipant.push({
        timezone: p.timezone,
        local_start: `${zs.date} ${zs.time.slice(0, 5)}`,
        local_end: `${ze.date} ${ze.time.slice(0, 5)}`,
        weekday: zs.weekday,
      });
    }
    if (ok) {
      slots.push({
        start_utc: new Date(t).toISOString(),
        end_utc: new Date(endT).toISOString(),
        participants: perParticipant,
      });
    }
  }

  return {
    duration_minutes: durationMinutes,
    date_range: dateRange,
    participants: parts.map((p) => ({ timezone: p.timezone, working_hours: p.wh })),
    slots,
    count: slots.length,
    note: slots.length === 0
      ? "No overlapping working-hour slot found in the given range."
      : undefined,
  };
}

function ceilTo(epochMs: number, stepMin: number): number {
  const step = stepMin * 60000;
  return Math.ceil(epochMs / step) * step;
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  const DAY = 86400000;
  for (; t <= e; t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
