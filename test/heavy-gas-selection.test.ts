import { describe, expect, it } from "vitest";
import { degadisFrictionVelocity, degadisMoninObukhovLength, idealGasDensity, selectHeavyGasModel } from "@/lib/model/heavyGasSelection";

const base = { ambientTempC: 10, gasTempC: 10, roughnessM: 0.03 };

describe("ALOHA 4.4.1 heavy-gas model selection", () => {
  it("matches the DEGADIS 2.1 wind profile (F, 2 m/s, 3 cm roughness: L = 14.3 m, u* = 0.0769 m/s)", () => {
    expect(degadisMoninObukhovLength("F", 0.03)).toBeCloseTo(14.3, 1);
    expect(degadisFrictionVelocity(2, "F", 0.03)).toBeCloseTo(0.07686, 4);
    expect(degadisMoninObukhovLength("D", 0.03)).toBe(0);
  });

  it("uses the Gaussian model for lighter-than-air gases (ammonia, methane, hydrogen)", () => {
    for (const molecularWeight of [17.031, 16.043, 2.016]) {
      const selection = selectHeavyGasModel({ ...base, molecularWeight, releaseRateKgPerSec: 50, windSpeed10mMps: 1.5, stabilityClass: "F" });
      expect(selection.denserThanAir).toBe(false);
      expect(selection.model).toBe("gaussian");
      expect(selection.richardsonNumber).toBeNull();
    }
  });

  it("selects the heavy-gas model for chlorine at night", () => {
    const selection = selectHeavyGasModel({ ...base, molecularWeight: 70.906, releaseRateKgPerSec: 1, windSpeed10mMps: 2, stabilityClass: "F" });
    expect(selection.model).toBe("heavy-gas");
    // Hand calculation: H = sqrt(E pi / (4 rho U10)), Ri = H g' / u*^2.
    const rho = idealGasDensity(70.906, 10);
    const rhoA = idealGasDensity(28.9586, 10);
    const H = Math.sqrt(1 * Math.PI / (4 * rho * 2));
    const ri = H * 9.81 * (rho - rhoA) / rhoA / 0.07686 ** 2;
    expect(selection.characteristicDimensionM).toBeCloseTo(H, 6);
    expect(selection.richardsonNumber!).toBeCloseTo(ri, 0);
  });

  it("treats a small, slightly dense release in strong unstable wind as passive (Ri < 1)", () => {
    const selection = selectHeavyGasModel({ ...base, molecularWeight: 34.08, releaseRateKgPerSec: 0.001, windSpeed10mMps: 8, stabilityClass: "C" });
    expect(selection.denserThanAir).toBe(true);
    expect(selection.richardsonNumber!).toBeLessThan(1);
    expect(selection.model).toBe("gaussian");
  });
});
