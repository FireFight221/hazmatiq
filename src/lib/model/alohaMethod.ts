// Neutrally buoyant gas dispersion following the published ALOHA 5.4.4 method.
//
// Every equation and coefficient below is taken from:
//   Jones, R., W. Lehr, D. Simecek-Beatty, R. M. Reynolds (2013). ALOHA (Areal
//   Locations of Hazardous Atmospheres) 5.4.4: Technical Documentation. NOAA
//   Technical Memorandum NOS OR&R 43.
//   https://response.restoration.noaa.gov/sites/default/files/ALOHA_Tech_Doc.pdf
//
// Section references are given beside each function. This is an independent
// implementation of the documented method, not NOAA's ALOHA software, and it
// has not been compared case-by-case against ALOHA output.

import type { StabilityClass } from "@/lib/schema";

export const ALOHA_TECH_DOC_REFERENCE = Object.freeze({
  name: "NOAA Technical Memorandum NOS OR&R 43 — ALOHA 5.4.4 Technical Documentation (2013)",
  url: "https://response.restoration.noaa.gov/sites/default/files/ALOHA_Tech_Doc.pdf",
});

/** ALOHA 1.2: not applicable below 1 m/s wind at 10 m. */
export const ALOHA_MIN_WIND_SPEED_10M_MPS = 1;
/** ALOHA 3.1: shortest source duration (an "instantaneous" release) is one minute. */
export const ALOHA_MIN_RELEASE_DURATION_SEC = 60;
/** ALOHA 3.1 / 4.3: source duration is limited to one hour. */
export const ALOHA_MAX_RELEASE_DURATION_SEC = 3600;
/** ALOHA executive summary: typical threat zones are 100 to 10,000 metres. */
export const ALOHA_TYPICAL_MIN_RANGE_M = 100;
export const ALOHA_TYPICAL_MAX_RANGE_M = 10_000;
/** ALOHA 4.2.3: roughness below 20 cm uses the rural (small roughness) sigma-z set. */
export const ALOHA_RURAL_ROUGHNESS_LIMIT_M = 0.2;
/** ALOHA 4.2.3 terrain presets. */
export const ALOHA_ROUGHNESS_PRESETS_M = Object.freeze({ rural: 0.03, urban: 1 });

type Coefficients = { sx1: number; sx2: number; sy1: number; sy2: number };
type SigmaZ = { sz1: number; sz2: number; sz3: number };

/** ALOHA Table 13 — coefficients used for both roughness sets (sigma-x, sigma-y). */
export const ALOHA_TABLE_13_BOTH: Readonly<Record<StabilityClass, Coefficients>> = Object.freeze({
  A: { sx1: 0.02, sx2: 1.22, sy1: 0.22, sy2: 0.0001 },
  B: { sx1: 0.02, sx2: 1.22, sy1: 0.16, sy2: 0.0001 },
  C: { sx1: 0.02, sx2: 1.22, sy1: 0.11, sy2: 0.0001 },
  D: { sx1: 0.04, sx2: 1.14, sy1: 0.08, sy2: 0.0001 },
  E: { sx1: 0.17, sx2: 0.97, sy1: 0.06, sy2: 0.0001 },
  F: { sx1: 0.17, sx2: 0.97, sy1: 0.04, sy2: 0.0001 },
});

/** ALOHA Table 13 — sigma-z, small surface roughness (rural). */
export const ALOHA_TABLE_13_RURAL_Z: Readonly<Record<StabilityClass, SigmaZ>> = Object.freeze({
  A: { sz1: 0.2, sz2: 0, sz3: 0 },
  B: { sz1: 0.12, sz2: 0, sz3: 0 },
  C: { sz1: 0.08, sz2: 0.0002, sz3: -0.5 },
  D: { sz1: 0.06, sz2: 0.0015, sz3: -0.5 },
  E: { sz1: 0.03, sz2: 0.0003, sz3: -1 },
  F: { sz1: 0.016, sz2: 0.0003, sz3: -1 },
});

/** ALOHA Table 13 — sigma-z, large surface roughness (urban). */
export const ALOHA_TABLE_13_URBAN_Z: Readonly<Record<StabilityClass, SigmaZ>> = Object.freeze({
  A: { sz1: 0.24, sz2: 0.001, sz3: 0.5 },
  B: { sz1: 0.24, sz2: 0.001, sz3: 0.5 },
  C: { sz1: 0.2, sz2: 0, sz3: 0 },
  D: { sz1: 0.14, sz2: 0.0003, sz3: -0.5 },
  E: { sz1: 0.08, sz2: 0.0015, sz3: -0.5 },
  F: { sz1: 0.08, sz2: 0.0015, sz3: -0.5 },
});

/** ALOHA 4.2.3: typical power-law wind-profile exponents for z0 = 15 cm, classes A-F. */
export const ALOHA_WIND_PROFILE_EXPONENT: Readonly<Record<StabilityClass, number>> = Object.freeze({
  A: 0.109, B: 0.112, C: 0.12, D: 0.142, E: 0.203, F: 0.253,
});

const STABILITY_ORDER: StabilityClass[] = ["A", "B", "C", "D", "E", "F"];

export type Surface = "rural" | "urban";

/** ALOHA 4.3.1: sigma-y = sy1 x / sqrt(1 + sy2 x), rural coefficients for all roughness. */
export function alohaSigmaY(x: number, cls: StabilityClass): number {
  const d = Math.max(0, x);
  const { sy1, sy2 } = ALOHA_TABLE_13_BOTH[cls];
  return (sy1 * d) / Math.sqrt(1 + sy2 * d);
}

/** ALOHA 4.3.1: sigma-z = sz1 x (1 + sz2 x)^sz3; rural if roughness < 20 cm. */
export function alohaSigmaZ(x: number, cls: StabilityClass, surface: Surface): number {
  const d = Math.max(0, x);
  const { sz1, sz2, sz3 } = (surface === "urban" ? ALOHA_TABLE_13_URBAN_Z : ALOHA_TABLE_13_RURAL_Z)[cls];
  return sz1 * d * Math.pow(1 + sz2 * d, sz3);
}

/** ALOHA 4.3.1 (Beals 1971): sigma-x = sx1 x^sx2. */
export function alohaSigmaX(x: number, cls: StabilityClass): number {
  const { sx1, sx2 } = ALOHA_TABLE_13_BOTH[cls];
  return sx1 * Math.pow(Math.max(0, x), sx2);
}

/** ALOHA 4.2.3 power-law wind profile, U2 = U1 (z2 / z1)^n. */
export function alohaWindAtHeight(windMps: number, fromHeightM: number, toHeightM: number, cls: StabilityClass): number {
  return windMps * Math.pow(toHeightM / fromHeightM, ALOHA_WIND_PROFILE_EXPONENT[cls]);
}

// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
export function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

export type AlohaGaussianSource = {
  /** Release rate during the release, kg/s. */
  releaseRateKgPerSec: number;
  /** Release duration, s (clamped to ALOHA's 60 s - 3600 s range). */
  releaseDurationSec: number;
  /** Wind speed, m/s. */
  windSpeedMps: number;
  stabilityClass: StabilityClass;
  surface: Surface;
  releaseHeightM: number;
};

export function clampReleaseDuration(durationSec: number | null | undefined): number {
  const value = Number(durationSec);
  if (!Number.isFinite(value) || value <= 0) return ALOHA_MAX_RELEASE_DURATION_SEC;
  return Math.min(ALOHA_MAX_RELEASE_DURATION_SEC, Math.max(ALOHA_MIN_RELEASE_DURATION_SEC, value));
}

/**
 * ALOHA 4.3: steady-state continuous point source term chi (Hanna et al. 1982)
 * with ground reflection, no inversion. Units: kg/m3.
 */
export function alohaChi(source: AlohaGaussianSource, x: number, y: number, z: number): number {
  if (x <= 0) return 0;
  const sy = Math.max(alohaSigmaY(x, source.stabilityClass), 1e-3);
  const sz = Math.max(alohaSigmaZ(x, source.stabilityClass, source.surface), 1e-3);
  const hs = source.releaseHeightM;
  const gy = Math.exp(-0.5 * (y / sy) ** 2) / (Math.sqrt(2 * Math.PI) * sy);
  const gz = (Math.exp(-0.5 * ((z - hs) / sz) ** 2) + Math.exp(-0.5 * ((z + hs) / sz) ** 2)) / (Math.sqrt(2 * Math.PI) * sz);
  return (source.releaseRateKgPerSec / source.windSpeedMps) * gy * gz;
}

/** ALOHA 4.3 (Palazzi et al. 1982): finite-duration release concentration at time t. kg/m3. */
export function alohaConcentration(source: AlohaGaussianSource, x: number, y: number, z: number, t: number): number {
  if (x <= 0 || t <= 0) return 0;
  const chi = alohaChi(source, x, y, z);
  if (chi === 0) return 0;
  const u = source.windSpeedMps;
  const tr = source.releaseDurationSec;
  const sx = Math.max(alohaSigmaX(x, source.stabilityClass), 1e-3) * Math.SQRT2;
  const term = t <= tr
    ? erf(x / sx) - erf((x - u * t) / sx)
    : erf((x - u * (t - tr)) / sx) - erf((x - u * t) / sx);
  return Math.max(0, (chi / 2) * term);
}

/**
 * ALOHA 4.5.1: maximum concentration over time at (x, y). Initial guess at
 * t0 = tm + x/u (tm is the release midpoint), then 30-second steps in the
 * increasing direction while concentration keeps increasing.
 */
export function alohaMaxConcentration(source: AlohaGaussianSource, x: number, y = 0, z = 0): number {
  if (x <= 0) return 0;
  const tm = source.releaseDurationSec / 2;
  const t0 = tm + x / source.windSpeedMps;
  const c = (t: number) => alohaConcentration(source, x, y, z, t);
  let best = c(t0);
  for (const direction of [1, -1]) {
    let t = t0 + 30 * direction;
    let value = c(t);
    if (value <= best) continue;
    while (value > best && t > 0) {
      best = value;
      t += 30 * direction;
      value = c(t);
    }
    break;
  }
  return best;
}

/** ALOHA 4.5.2: off-axis distance to the LOC, y = sigma-y sqrt(2 ln(M(x,0) / LOC)). */
export function alohaCrosswindHalfWidth(source: AlohaGaussianSource, x: number, centerlineMax: number, locKgM3: number): number {
  if (!(centerlineMax > locKgM3)) return 0;
  return alohaSigmaY(x, source.stabilityClass) * Math.sqrt(2 * Math.log(centerlineMax / locKgM3));
}

/**
 * ALOHA 4.5.3: confidence-line half angle alpha = arctan(2 sigma-y / (300 U3)),
 * with sigma-y evaluated 5 minutes downwind (x = 300 U3). U3 is derived from
 * the 10 m wind using the ALOHA 4.2.3 power-law profile.
 */
export function alohaConfidenceHalfAngleDeg(windSpeed10mMps: number, cls: StabilityClass): number {
  const u3 = alohaWindAtHeight(windSpeed10mMps, 10, 3, cls);
  const x = 300 * u3;
  return (Math.atan((2 * alohaSigmaY(x, cls)) / x) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Stability class (ALOHA 4.2.1, manual data entry)
// ---------------------------------------------------------------------------

export type StabilityDetermination = {
  stabilityClass: StabilityClass;
  period: "day" | "night";
  insolation: "strong" | "moderate" | "slight" | null;
  solarAltitudeDeg: number;
  insolationWm2: number | null;
  cloudCoverPct: number | null;
  windSpeed10mMps: number;
  basis: string[];
};

const DAY_TABLE: Record<"strong" | "moderate" | "slight", StabilityClass[][]> = {
  //            <2          2-3          3-5          5-6          >6
  strong: [["A"], ["A", "B"], ["B"], ["C"], ["C"]],
  moderate: [["A", "B"], ["B"], ["B", "C"], ["C", "D"], ["D"]],
  slight: [["B"], ["C"], ["C"], ["D"], ["D"]],
};
const NIGHT_TABLE: Record<"cloudy" | "clear", StabilityClass[]> = {
  cloudy: ["E", "E", "D", "D", "D"], // > 50% cloud cover
  clear: ["F", "F", "E", "D", "D"], // < 50% cloud cover
};

function windRow(u10: number): number {
  if (u10 < 2) return 0;
  if (u10 < 3) return 1;
  if (u10 < 5) return 2;
  if (u10 < 6) return 3;
  return 4;
}

/** ALOHA 4.2.1: "If more than one stability class fits ... ALOHA selects the most stable." */
function mostStable(classes: StabilityClass[]): StabilityClass {
  return classes.reduce((a, b) => (STABILITY_ORDER.indexOf(b) > STABILITY_ORDER.indexOf(a) ? b : a));
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000) + 1;
}

/** ALOHA 4.2.1 solar altitude (degrees) and solar declination / hour angle (radians). */
export function alohaSolarGeometry(latDeg: number, lonDeg: number, date: Date) {
  const rad = Math.PI / 180;
  const J = dayOfYear(date);
  const Z = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const declination = 23.45 * rad * Math.sin(0.986 * rad * (J - 80));
  const hourAngle = 15 * rad * (12 - Z - lonDeg / 15);
  const lat = latDeg * rad;
  const sinAlt = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return { solarAltitudeDeg: Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad, sinAltitude: sinAlt, declination, hourAngle, lat };
}

/**
 * ALOHA 4.2.1 nighttime: "the time between one hour before sunset to one
 * hour after sunrise". Sunrise/sunset hour angle from cos h0 = -tan(lat) tan(dec).
 */
function isAlohaNight(geometry: ReturnType<typeof alohaSolarGeometry>): boolean {
  const cosH0 = -Math.tan(geometry.lat) * Math.tan(geometry.declination);
  if (cosH0 <= -1) return false; // polar day
  if (cosH0 >= 1) return true; // polar night
  const h0 = Math.acos(cosH0);
  const oneHour = (15 * Math.PI) / 180;
  let h = geometry.hourAngle % (2 * Math.PI);
  if (h > Math.PI) h -= 2 * Math.PI;
  if (h < -Math.PI) h += 2 * Math.PI;
  return Math.abs(h) > h0 - oneHour;
}

/**
 * ALOHA 4.2.1 / Table 10 stability class from 10 m wind, location, time and
 * cloud cover. Insolation from Raphael (1962):
 *   Fs = 1111 (1 - 0.0071 CI^2)(sin(phi) - 0.1) for sin(phi) > 0.1, else 0.
 * When cloud cover is unknown, the most stable outcome consistent with the
 * table is used (clear sky at night, overcast by day) and stated in the basis.
 */
export function alohaStabilityClass(input: {
  windSpeed10mMps: number;
  latDeg: number;
  lonDeg: number;
  observationTime: Date;
  cloudCoverPct?: number | null;
}): StabilityDetermination {
  const u10 = input.windSpeed10mMps;
  const geometry = alohaSolarGeometry(input.latDeg, input.lonDeg, input.observationTime);
  const cloud = Number.isFinite(Number(input.cloudCoverPct)) && input.cloudCoverPct !== null
    ? Math.min(100, Math.max(0, Number(input.cloudCoverPct)))
    : null;
  const night = isAlohaNight(geometry);
  const row = windRow(u10);
  const basis = [
    `Wind at 10 m: ${u10.toFixed(1)} m/s.`,
    `Solar altitude: ${geometry.solarAltitudeDeg.toFixed(1)}°; ${night ? "night (1 h before sunset to 1 h after sunrise)" : "day"}.`,
  ];
  const result = (stabilityClass: StabilityClass, insolation: StabilityDetermination["insolation"], insolationWm2: number | null) => ({
    stabilityClass, period: night ? "night" as const : "day" as const, insolation,
    solarAltitudeDeg: geometry.solarAltitudeDeg, insolationWm2, cloudCoverPct: cloud, windSpeed10mMps: u10, basis,
  });
  if (cloud !== null && cloud >= 100) {
    basis.push("Completely overcast: stability D (ALOHA Table 10 note).");
    return result("D", null, null);
  }
  if (night) {
    if (cloud === null) basis.push("Cloud cover unavailable: clear sky (<50%) assumed, the more stable night column.");
    else basis.push(`Cloud cover ${Math.round(cloud)}% (${cloud > 50 ? ">50%" : "<50%"}).`);
    const column = cloud !== null && cloud > 50 ? "cloudy" : "clear";
    return result(NIGHT_TABLE[column][row], null, null);
  }
  if (cloud === null) {
    basis.push("Cloud cover unavailable: overcast assumed (stability D), the most stable daytime outcome.");
    return result("D", null, null);
  }
  const ci = cloud / 10;
  const sinPhi = geometry.sinAltitude;
  const fs = sinPhi > 0.1 ? 1111 * (1 - 0.0071 * ci * ci) * (sinPhi - 0.1) : 0;
  const insolation = fs > 851 ? "strong" : fs > 526 ? "moderate" : "slight";
  basis.push(`Cloud cover ${Math.round(cloud)}%; insolation ${Math.round(fs)} W/m² (${insolation}${fs < 176 ? ", below the 176 W/m² slight threshold; slight used" : ""}).`);
  return result(mostStable(DAY_TABLE[insolation][row]), insolation, Math.round(fs));
}
