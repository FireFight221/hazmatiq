import { describe, expect, it } from "vitest";
import { calculateReleaseRate } from "../src/lib/model/releaseRate";
import { britterMcQuaidBeta, denseGasScreen, windShiftHalfAngleDeg } from "../src/lib/model/denseGasBritterMcQuaid";

describe("release-rate calculator", () => {
  it("matches a hand-calculated Bernoulli liquid orifice (water, 1 in hole, 10 ft head)", () => {
    const result = calculateReleaseRate({ phase: "liquid", holeDiameterIn: 1, tankPressurePsig: 0, liquidDensityGcm3: 1, liquidHeadFt: 10 });
    // 0.8 * pi*(0.0127)^2 * 1000 * sqrt(2*9.80665*3.048) = 3.135 kg/s
    expect(result.ok).toBe(true);
    expect(result.flowRegime).toBe("liquid");
    expect(result.kgPerSec).toBeCloseTo(3.135, 2);
  });

  it("uses choked flow for a pressurized gas and scales linearly with absolute pressure and hole area", () => {
    const base = { phase: "gas" as const, holeDiameterIn: 0.25, tankTempF: 70, molecularWeight: 70.91, heatCapacityRatio: 1.33 };
    const a = calculateReleaseRate({ ...base, tankPressurePsig: 100 });
    const b = calculateReleaseRate({ ...base, tankPressurePsig: 2 * (100 + 14.696) - 14.696 });
    const c = calculateReleaseRate({ ...base, holeDiameterIn: 0.5, tankPressurePsig: 100 });
    expect(a.flowRegime).toBe("choked");
    expect(b.kgPerSec! / a.kgPerSec!).toBeCloseTo(2, 2);
    expect(c.kgPerSec! / a.kgPerSec!).toBeCloseTo(4, 2);
    // Independent check in EPA RMP OCA US units (Eq. 7-1: QR = HA * Pt / sqrt(Tt) * GF),
    // GF = 60 * 0.8 * sqrt(gc * gamma * MW / (1545 * 1.8) * (2/(gamma+1))^((gamma+1)/(gamma-1))).
    const gamma = 1.33;
    const gf = 60 * 0.8 * Math.sqrt((32.174 * gamma * 70.91) / (1545.35 * 1.8) * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)));
    const tempK = (70 - 32) * (5 / 9) + 273.15;
    const holeAreaIn2 = Math.PI * 0.125 ** 2;
    const epaLbPerMin = holeAreaIn2 * (100 + 14.696) / Math.sqrt(tempK) * gf;
    expect(a.lbPerMin!).toBeCloseTo(epaLbPerMin, 0);
  });

  it("is continuous across the choked/subsonic boundary", () => {
    const gamma = 1.4;
    const critical = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
    const p0Psia = 14.696 / critical;
    const below = calculateReleaseRate({ phase: "gas", holeDiameterIn: 1, tankTempF: 68, molecularWeight: 28.96, heatCapacityRatio: gamma, tankPressurePsig: p0Psia - 14.696 - 0.01 });
    const above = calculateReleaseRate({ phase: "gas", holeDiameterIn: 1, tankTempF: 68, molecularWeight: 28.96, heatCapacityRatio: gamma, tankPressurePsig: p0Psia - 14.696 + 0.01 });
    expect(below.flowRegime).toBe("subsonic");
    expect(above.flowRegime).toBe("choked");
    expect(Math.abs(above.kgPerSec! - below.kgPerSec!) / above.kgPerSec!).toBeLessThan(0.01);
  });

  it("estimates duration from available quantity and rejects missing inputs", () => {
    const result = calculateReleaseRate({ phase: "liquid", holeDiameterIn: 1, tankPressurePsig: 0, liquidDensityGcm3: 1, liquidHeadFt: 10, availableQuantityLb: 1000 });
    expect(result.durationMinutes).toBeCloseTo(1000 / result.lbPerMin!, 0);
    expect(calculateReleaseRate({ phase: "gas", holeDiameterIn: 1, tankPressurePsig: 50 }).ok).toBe(false);
    expect(calculateReleaseRate({ phase: "liquid", holeDiameterIn: 0, tankPressurePsig: 10, liquidDensityGcm3: 1 }).ok).toBe(false);
  });
});

describe("Britter-McQuaid dense-gas screen", () => {
  it("reproduces the tabulated continuous-release curves", () => {
    expect(britterMcQuaidBeta(0.1, -0.6)).toBeCloseTo(1.75, 6);
    expect(britterMcQuaidBeta(0.05, -0.5)).toBeCloseTo(0.36 * -0.5 + 2.16, 6);
    expect(britterMcQuaidBeta(0.01, -0.25)).toBeCloseTo(2.45, 6);
    expect(britterMcQuaidBeta(0.002, 0.5)).toBeCloseTo(-0.5 * 0.5 + 2.71, 6);
    expect(britterMcQuaidBeta(0.002, 1.2)).toBeNull();
  });

  it("interpolates between curves so lower concentrations reach farther", () => {
    const b1 = britterMcQuaidBeta(0.02, -0.4)!;
    const bMid = britterMcQuaidBeta(0.015, -0.4)!;
    const b2 = britterMcQuaidBeta(0.01, -0.4)!;
    expect(bMid).toBeGreaterThan(b1);
    expect(bMid).toBeLessThan(b2);
  });

  it("flags chlorine at light wind as dense and orders distances by concentration", () => {
    const result = denseGasScreen({ releaseRateKgPerSec: 2, molecularWeight: 70.91, windSpeedMps: 2, ambientTempC: 20, levels: [
      { id: "a", label: "10%", volumeFraction: 0.1 },
      { id: "b", label: "1%", volumeFraction: 0.01 },
      { id: "c", label: "0.2%", volumeFraction: 0.002 },
      { id: "d", label: "AEGL", volumeFraction: 2e-6 },
    ] });
    expect(result.applicable).toBe(true);
    expect(result.densityRatio!).toBeGreaterThan(2.3);
    const [ten, one, fifth, aegl] = result.levels;
    expect(ten.distanceM!).toBeLessThan(one.distanceM!);
    expect(one.distanceM!).toBeLessThan(fifth.distanceM!);
    expect(aegl.distanceM).toBeNull();
    expect(aegl.note).toMatch(/Gaussian/);
  });

  it("does not apply to lighter-than-air vapor or weak releases in strong wind", () => {
    expect(denseGasScreen({ releaseRateKgPerSec: 1, molecularWeight: 17.03, windSpeedMps: 3, ambientTempC: 20, levels: [] }).applicable).toBe(false);
    const weak = denseGasScreen({ releaseRateKgPerSec: 0.001, molecularWeight: 44.1, windSpeedMps: 15, ambientTempC: 20, levels: [] });
    expect(weak.applicable).toBe(false);
    expect(weak.reason).toMatch(/criterion/);
  });

  it("widens wind-shift confidence lines in light wind", () => {
    expect(windShiftHalfAngleDeg(0.5)).toBeGreaterThan(windShiftHalfAngleDeg(2.5));
    expect(windShiftHalfAngleDeg(2.5)).toBeGreaterThan(windShiftHalfAngleDeg(8));
  });
});
