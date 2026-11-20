import type { StabilityClass } from "@/lib/schema";

type DispersionFunction = (downwindDistanceM: number) => number;
type DispersionPair = { sigmaY: DispersionFunction; sigmaZ: DispersionFunction };

const nonnegativeDistance = (distanceM: number) => Math.max(0, distanceM);
const power = (coefficient: number, modifier: number, exponent: number): DispersionFunction =>
  (distanceM) => {
    const x = nonnegativeDistance(distanceM);
    return coefficient * x * Math.pow(1 + modifier * x, exponent);
  };
const linear = (coefficient: number): DispersionFunction =>
  (distanceM) => coefficient * nonnegativeDistance(distanceM);

/** Briggs open-country coefficients; x, sigma-y, and sigma-z are metres. */
export const BRIGGS_RURAL: Readonly<Record<StabilityClass, DispersionPair>> = {
  A: { sigmaY: power(0.22, 0.0001, -0.5), sigmaZ: linear(0.20) },
  B: { sigmaY: power(0.16, 0.0001, -0.5), sigmaZ: linear(0.12) },
  C: { sigmaY: power(0.11, 0.0001, -0.5), sigmaZ: power(0.08, 0.0002, -0.5) },
  D: { sigmaY: power(0.08, 0.0001, -0.5), sigmaZ: power(0.06, 0.0015, -0.5) },
  E: { sigmaY: power(0.06, 0.0001, -0.5), sigmaZ: power(0.03, 0.0003, -1) },
  F: { sigmaY: power(0.04, 0.0001, -0.5), sigmaZ: power(0.016, 0.0003, -1) },
};

/** Briggs urban coefficients; EPA groups A/B and E/F. */
export const BRIGGS_URBAN: Readonly<Record<StabilityClass, DispersionPair>> = {
  A: { sigmaY: power(0.32, 0.0004, -0.5), sigmaZ: power(0.24, 0.001, 0.5) },
  B: { sigmaY: power(0.32, 0.0004, -0.5), sigmaZ: power(0.24, 0.001, 0.5) },
  C: { sigmaY: power(0.22, 0.0004, -0.5), sigmaZ: linear(0.20) },
  D: { sigmaY: power(0.16, 0.0004, -0.5), sigmaZ: power(0.14, 0.0003, -0.5) },
  E: { sigmaY: power(0.11, 0.0004, -0.5), sigmaZ: power(0.08, 0.0015, -0.5) },
  F: { sigmaY: power(0.11, 0.0004, -0.5), sigmaZ: power(0.08, 0.0015, -0.5) },
};

/**
 * ALOHA 5.4.4 Technical Documentation section 4.3.1: ALOHA uses only the rural
 * (3-minute averaging) sigma-y coefficients for every surface roughness, and
 * the urban sigma-z set when roughness is 20 cm or more.
 */
export function pickRoughness(
  cls: StabilityClass,
  surface: "urban" | "rural",
): DispersionPair {
  return surface === "urban"
    ? { sigmaY: BRIGGS_RURAL[cls].sigmaY, sigmaZ: BRIGGS_URBAN[cls].sigmaZ }
    : BRIGGS_RURAL[cls];
}
