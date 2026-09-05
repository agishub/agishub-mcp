/**
 * Date arithmetic that respects DST:
 *   - days / weeks are added on the *calendar* (same local wall-clock time next
 *     day, so a cross-DST "+1 day" is still the same local hour), while
 *   - hours / minutes / seconds are added in *absolute* time (real elapsed
 *     duration), which may shift the local wall-clock across a DST boundary.
 * Also computes the signed difference between two instants in any two zones.
 */

import { formatZoned, wallTimeToEpoch, ZonedTime, TzError } from "./tz";

export type Unit = "seconds" | "minutes" | "hours" | "days" | "weeks";

const ABSOLUTE: Record<string, number> = {
  seconds: 1000,
  minutes: 60000,
  hours: 3600000,
};

/** Add (or subtract, with a negative amount) an amount to an instant in `tz`. */
export function addToInstant(
  epochMs: number,
  tz: string,
  amount: number,
  unit: Unit,
): number {
  if (!Number.isFinite(amount)) throw new TzError("amount must be a number.");
  if (unit === "seconds" || unit === "minutes" || unit === "hours") {
    return epochMs + amount * ABSOLUTE[unit];
  }
  if (unit === "days" || unit === "weeks") {
    const days = unit === "weeks" ? amount * 7 : amount;
    const z = formatZoned(epochMs, tz);
    const [y, mo, d] = z.date.split("-").map(Number);
    const shifted = new Date(Date.UTC(y, mo - 1, d + days));
    const nd = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
      shifted.getUTCDate(),
    )}`;
    return wallTimeToEpoch(`${nd}T${z.time}`, tz);
  }
  throw new TzError(`Unknown unit "${unit}". Use seconds|minutes|hours|days|weeks.`);
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface DiffResult {
  from: ZonedTime;
  to: ZonedTime;
  total_seconds: number;
  total_minutes: number;
  total_hours: number;
  total_days: number;
  breakdown: { days: number; hours: number; minutes: number; seconds: number };
  humanized: string;
}

/** Signed difference (to - from) between two instants, expressed richly. */
export function diffInstants(
  fromEpoch: number,
  fromTz: string,
  toEpoch: number,
  toTz: string,
): DiffResult {
  const ms = toEpoch - fromEpoch;
  const sign = ms < 0 ? -1 : 1;
  let rem = Math.abs(ms);
  const days = Math.floor(rem / 86400000);
  rem -= days * 86400000;
  const hours = Math.floor(rem / 3600000);
  rem -= hours * 3600000;
  const minutes = Math.floor(rem / 60000);
  rem -= minutes * 60000;
  const seconds = Math.floor(rem / 1000);
  const parts = [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    seconds ? `${seconds}s` : "",
  ].filter(Boolean);
  return {
    from: formatZoned(fromEpoch, fromTz),
    to: formatZoned(toEpoch, toTz),
    total_seconds: Math.round(ms / 1000),
    total_minutes: Math.round(ms / 60000),
    total_hours: Math.round((ms / 3600000) * 100) / 100,
    total_days: Math.round((ms / 86400000) * 100) / 100,
    breakdown: {
      days: sign * days,
      hours: sign * hours,
      minutes: sign * minutes,
      seconds: sign * seconds,
    },
    humanized: `${sign < 0 ? "-" : ""}${parts.join(" ") || "0s"}`,
  };
}
