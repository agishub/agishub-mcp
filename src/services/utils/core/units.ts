/**
 * Pure unit conversion. Linear categories convert via a base-unit factor;
 * temperature is handled separately (offsets). Unit names are case-insensitive.
 */

type Factors = Record<string, number>;

const CATEGORIES: Record<string, Factors> = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 },
  volume: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365, floz: 0.0295735295625 },
  speed: { "m/s": 1, "km/h": 0.27777777778, mph: 0.44704, kn: 0.51444444444, "ft/s": 0.3048 },
  area: { m2: 1, km2: 1e6, cm2: 1e-4, ha: 1e4, acre: 4046.8564224, ft2: 0.09290304, mi2: 2589988.110336 },
  data: { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 },
  time: { s: 1, ms: 0.001, min: 60, h: 3600, day: 86400, week: 604800 },
};

const TEMP = new Set(["c", "f", "k"]);

function toCelsius(v: number, u: string): number {
  if (u === "c") return v;
  if (u === "f") return (v - 32) * 5 / 9;
  return v - 273.15; // k
}
function fromCelsius(c: number, u: string): number {
  if (u === "c") return c;
  if (u === "f") return c * 9 / 5 + 32;
  return c + 273.15; // k
}

export function convert(value: number, from: string, to: string) {
  const fromU = from.trim();
  const toU = to.trim();
  const fl = fromU.toLowerCase();
  const tl = toU.toLowerCase();

  if (TEMP.has(fl) && TEMP.has(tl)) {
    return { value, from: fromU, to: toU, result: fromCelsius(toCelsius(value, fl), tl), category: "temperature" };
  }

  for (const [category, table] of Object.entries(CATEGORIES)) {
    const lc: Factors = {};
    for (const [k, v] of Object.entries(table)) lc[k.toLowerCase()] = v;
    if (fl in lc && tl in lc) {
      return { value, from: fromU, to: toU, result: (value * lc[fl]) / lc[tl], category };
    }
  }
  throw new Error(
    `Unknown or incompatible units: '${from}' -> '${to}'. Categories: length, mass, volume, speed, area, data, time, temperature (C/F/K).`,
  );
}
