import { describe, expect, it } from "vitest";
import {
  alohaConcentration,
  alohaConfidenceHalfAngleDeg,
  alohaMaxConcentration,
  alohaSigmaX,
  alohaSigmaY,
  alohaSigmaZ,
  alohaStabilityClass,
  clampReleaseDuration,
  erf,
  runPlume,
} from "@/lib/model";
import type { PlumeInputs, ThresholdBand } from "@/lib/schema";

// Values below are hand-computed from ALOHA 5.4.4 Technical Documentation
// (NOAA TM NOS OR&R 43) Table 13 and sections 4.2-4.5.
describe("ALOHA 5.4.4 documented Gaussian method", () => {
  it("uses Table 13 dispersion coefficients", () => {
    expect(alohaSigmaY(1000, "D")).toBeCloseTo((0.08 * 1000) / Math.sqrt(1.1), 10);
    expect(alohaSigmaZ(1000, "D", "rural")).toBeCloseTo(0.06 * 1000 * Math.pow(2.5, -0.5), 10);
    expect(alohaSigmaZ(1000, "F", "rural")).toBeCloseTo(0.016 * 1000 / 1.3, 10);
    expect(alohaSigmaZ(1000, "D", "urban")).toBeCloseTo(0.14 * 1000 * Math.pow(1.3, -0.5), 10);
    expect(alohaSigmaX(1000, "D")).toBeCloseTo(0.04 * Math.pow(1000, 1.14), 10);
    expect(alohaSigmaX(1000, "F")).toBeCloseTo(0.17 * Math.pow(1000, 0.97), 10);
  });

  it("uses rural sigma-y for urban terrain (ALOHA 4.3.1)", () => {
    const base = { releaseRateKgPerSec: 1, releaseDurationSec: 3600, windSpeedMps: 3, stabilityClass: "D" as const, releaseHeightM: 0 };
    const rural = alohaMaxConcentration({ ...base, surface: "rural" }, 500);
    const urban = alohaMaxConcentration({ ...base, surface: "urban" }, 500);
    const sy = alohaSigmaY(500, "D");
    expect(rural).toBeCloseTo(1 / (Math.PI * 3 * sy * alohaSigmaZ(500, "D", "rural")), 8);
    expect(urban).toBeCloseTo(1 / (Math.PI * 3 * sy * alohaSigmaZ(500, "D", "urban")), 8);
  });

  it("matches the steady-state ground-level centerline for a long release", () => {
    const source = { releaseRateKgPerSec: 2, releaseDurationSec: 3600, windSpeedMps: 4, stabilityClass: "D" as const, surface: "rural" as const, releaseHeightM: 0 };
    const x = 400;
    const steady = 2 / (Math.PI * 4 * alohaSigmaY(x, "D") * alohaSigmaZ(x, "D", "rural"));
    expect(alohaMaxConcentration(source, x)).toBeCloseTo(steady, 6);
  });

  it("reduces peak concentration for a one-minute release far downwind (Palazzi)", () => {
    const longRelease = { releaseRateKgPerSec: 1, releaseDurationSec: 3600, windSpeedMps: 2, stabilityClass: "F" as const, surface: "rural" as const, releaseHeightM: 0 };
    const shortRelease = { ...longRelease, releaseDurationSec: 60 };
    expect(alohaMaxConcentration(shortRelease, 3000)).toBeLessThan(alohaMaxConcentration(longRelease, 3000));
    expect(alohaConcentration(longRelease, 3000, 0, 0, 1)).toBeLessThan(alohaMaxConcentration(longRelease, 3000));
  });

  it("clamps release duration to ALOHA's 1 minute to 1 hour", () => {
    expect(clampReleaseDuration(10)).toBe(60);
    expect(clampReleaseDuration(7200)).toBe(3600);
    expect(clampReleaseDuration(undefined)).toBe(3600);
    expect(erf(0.5)).toBeCloseTo(0.5204999, 6);
  });

  it("computes the confidence-line angle from the 5-minute plume width", () => {
    const u3 = 3 * Math.pow(0.3, 0.142);
    const x = 300 * u3;
    const expected = (Math.atan((2 * alohaSigmaY(x, "D")) / x) * 180) / Math.PI;
    expect(alohaConfidenceHalfAngleDeg(3, "D")).toBeCloseTo(expected, 10);
  });
});

describe("ALOHA 4.2.1 stability class", () => {
  // Alabaster, AL
  const lat = 33.244;
  const lon = -86.816;
  it("strong summer insolation and light wind give class A", () => {
    const r = alohaStabilityClass({ windSpeed10mMps: 1.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-01T18:00:00Z"), cloudCoverPct: 0 });
    expect(r.period).toBe("day");
    expect(r.insolation).toBe("strong");
    expect(r.stabilityClass).toBe("A");
  });
  it("clear night and light wind give class F", () => {
    const r = alohaStabilityClass({ windSpeed10mMps: 1.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-02T07:00:00Z"), cloudCoverPct: 10 });
    expect(r.period).toBe("night");
    expect(r.stabilityClass).toBe("F");
  });
  it("cloudy night at 2-3 m/s gives E; overcast gives D", () => {
    expect(alohaStabilityClass({ windSpeed10mMps: 2.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-02T07:00:00Z"), cloudCoverPct: 80 }).stabilityClass).toBe("E");
    expect(alohaStabilityClass({ windSpeed10mMps: 1.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-02T07:00:00Z"), cloudCoverPct: 100 }).stabilityClass).toBe("D");
  });
  it("selects the most stable class when two fit (moderate insolation, 3-5 m/s -> C)", () => {
    const r = alohaStabilityClass({ windSpeed10mMps: 4, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-11-19T18:00:00Z"), cloudCoverPct: 0 });
    expect(r.insolation).toBe("moderate");
    expect(r.stabilityClass).toBe("C");
  });
  it("uses the most stable assumption when cloud cover is unknown", () => {
    expect(alohaStabilityClass({ windSpeed10mMps: 1.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-02T07:00:00Z") }).stabilityClass).toBe("F");
    expect(alohaStabilityClass({ windSpeed10mMps: 1.5, latDeg: lat, lonDeg: lon, observationTime: new Date("2026-07-01T18:00:00Z") }).stabilityClass).toBe("D");
  });
});

describe("runPlume with the ALOHA method", () => {
  const inputs: PlumeInputs = {
    chemicalId: "chlorine", releaseKind: "plume", releaseRateKgPerSec: 1, releaseHeightM: 0,
    windSpeedMps: 2, windDirDeg: 270, stabilityClass: "D", surfaceRoughness: "rural", tempC: 20, molecularWeight: 70.9,
  };
  const thresholds: ThresholdBand[] = [{ kind: "AEGL", level: 2, valuePpm: 2, label: "AEGL-2" }];

  it("night stability F reaches much farther than D", () => {
    const d = runPlume(inputs, { thresholds }).isopleths[0].maxDownwindM;
    const f = runPlume({ ...inputs, stabilityClass: "F" }, { thresholds }).isopleths[0].maxDownwindM;
    expect(f).toBeGreaterThan(d * 2);
  });

  it("solves the downwind endpoint where the peak concentration equals the LOC", () => {
    const r = runPlume(inputs, { thresholds });
    const zone = r.isopleths[0];
    const locKgM3 = (2 * 70.9) / (0.08205746 * 293.15) / 1e6;
    const source = { releaseRateKgPerSec: 1, releaseDurationSec: 3600, windSpeedMps: 2, stabilityClass: "D" as const, surface: "rural" as const, releaseHeightM: 0 };
    expect(alohaMaxConcentration(source, zone.maxDownwindM) / locKgM3).toBeCloseTo(1, 2);
  });

  it("rejects wind below 1 m/s", () => {
    expect(() => runPlume({ ...inputs, windSpeedMps: 0.8 }, { thresholds })).toThrow(/below 1 m\/s/);
  });

  it("models an instantaneous puff as a one-minute release with a maximum-over-time footprint", () => {
    const puff = runPlume({ ...inputs, releaseKind: "puff", releaseRateKgPerSec: undefined, totalMassKg: 60, durationSec: 60 }, { thresholds });
    const plume1min = runPlume(inputs, { thresholds, releaseDurationSec: 60 });
    expect(puff.isopleths[0].maxDownwindM).toBeCloseTo(plume1min.isopleths[0].maxDownwindM, 3);
  });
});
