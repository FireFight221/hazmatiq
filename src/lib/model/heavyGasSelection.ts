// ALOHA 5.4.4 Technical Documentation 4.4.1: choice between the Gaussian and
// Heavy Gas (DEGADIS) dispersion models.
//
//   Ri_c = H * g_hat / U*^2,   g_hat = g (rho - rho_a) / rho_a
//   continuous / semi-continuous source:  H = sqrt(E pi / (4 rho U10))
//
// When Ri_c < 1 the gas is passive and the Gaussian model is used. A gas that is
// not denser than air always uses the Gaussian model (ALOHA 4.4.1: "The
// Gaussian model is also recommended when the pollutant cloud is less dense than
// air"). U* is computed the way DEGADIS 2.1 computes it (ALPH.FOR, PSIF.FOR,
// ATMDEF.FOR) so the selection and the heavy-gas run share one wind profile.

import type { StabilityClass } from "@/lib/schema";

export const ALOHA_HEAVY_GAS_REFERENCE = Object.freeze({
  name: "ALOHA 5.4.4 Technical Documentation (NOAA Technical Memorandum NOS OR&R 43, 2013), section 4.4.1",
  url: "https://response.restoration.noaa.gov/sites/default/files/ALOHA_Tech_Doc.pdf",
});

const GAS_CONSTANT = 8.314462618; // J/(mol K)
const AIR_MW = 28.9586; // g/mol, dry air
const STANDARD_PRESSURE_PA = 101325;
const GRAVITY = 9.81; // DEGADIS 2.1 DEG1.FOR
const VON_KARMAN = 0.35; // DEGADIS 2.1 DEG1.FOR
const WIND_REFERENCE_HEIGHT_M = 10;

const STABILITY_INDEX: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };

/** DEGADIS 2.1 ATMDEF.FOR default Monin-Obukhov length (m); 0 means neutral (infinite). */
export function degadisMoninObukhovLength(stabilityClass: StabilityClass | string, roughnessM: number): number {
  switch (String(stabilityClass).toUpperCase()) {
    case "A": return -11.43 * roughnessM ** 0.103;
    case "B": return -25.98 * roughnessM ** 0.171;
    case "C": return -123.4 * roughnessM ** 0.304;
    case "D": return 0;
    case "E": return 123.4 * roughnessM ** 0.304;
    case "F": return 25.98 * roughnessM ** 0.171;
    default: throw new Error(`Unknown stability class ${stabilityClass}`);
  }
}

/** DEGADIS 2.1 PSIF.FOR (Businger) stability correction to the log wind profile. */
export function degadisPsi(z: number, moninObukhovLengthM: number): number {
  if (moninObukhovLengthM === 0) return 0;
  if (moninObukhovLengthM < 0) {
    const a = (1 - 15 * z / moninObukhovLengthM) ** 0.25;
    return 2 * Math.log((1 + a) / 2) + Math.log((1 + a * a) / 2) - 2 * Math.atan(a) + Math.PI / 2;
  }
  return -4.7 * z / moninObukhovLengthM;
}

/** DEGADIS 2.1 ALPH.FOR friction velocity for a wind speed measured at 10 m. */
export function degadisFrictionVelocity(windSpeed10mMps: number, stabilityClass: StabilityClass | string, roughnessM: number): number {
  const L = degadisMoninObukhovLength(stabilityClass, roughnessM);
  const denominator = Math.log((WIND_REFERENCE_HEIGHT_M + roughnessM) / roughnessM) - degadisPsi(WIND_REFERENCE_HEIGHT_M, L);
  return windSpeed10mMps * VON_KARMAN / denominator;
}

export function idealGasDensity(molecularWeight: number, tempC: number, pressurePa = STANDARD_PRESSURE_PA): number {
  return pressurePa * (molecularWeight / 1000) / (GAS_CONSTANT * (tempC + 273.15));
}

export function degadisStabilityIndex(stabilityClass: StabilityClass | string): number {
  const index = STABILITY_INDEX[String(stabilityClass).toUpperCase()];
  if (!index) throw new Error(`Unknown stability class ${stabilityClass}`);
  return index;
}

export type HeavyGasSelectionInput = {
  /** Continuous release rate, kg/s. For an instantaneous release use mass / 60 s (ALOHA 4.3 one-minute release). */
  releaseRateKgPerSec: number;
  molecularWeight: number;
  /** Temperature of the released vapor; ambient when the release temperature is not known. */
  gasTempC: number;
  ambientTempC: number;
  windSpeed10mMps: number;
  stabilityClass: StabilityClass | string;
  roughnessM: number;
};

export type HeavyGasSelection = {
  model: "heavy-gas" | "gaussian";
  denserThanAir: boolean;
  gasDensityKgM3: number;
  airDensityKgM3: number;
  densityRatio: number;
  reducedGravityMps2: number;
  frictionVelocityMps: number;
  characteristicDimensionM: number | null;
  richardsonNumber: number | null;
  reason: string;
  reference: typeof ALOHA_HEAVY_GAS_REFERENCE;
};

export function selectHeavyGasModel(input: HeavyGasSelectionInput): HeavyGasSelection {
  const gasDensity = idealGasDensity(input.molecularWeight, input.gasTempC);
  const airDensity = idealGasDensity(AIR_MW, input.ambientTempC);
  const reducedGravity = GRAVITY * (gasDensity - airDensity) / airDensity;
  const frictionVelocity = degadisFrictionVelocity(input.windSpeed10mMps, input.stabilityClass, input.roughnessM);
  const base = {
    gasDensityKgM3: gasDensity,
    airDensityKgM3: airDensity,
    densityRatio: gasDensity / airDensity,
    reducedGravityMps2: reducedGravity,
    frictionVelocityMps: frictionVelocity,
    reference: ALOHA_HEAVY_GAS_REFERENCE,
  };
  if (!(gasDensity > airDensity)) {
    return {
      ...base,
      model: "gaussian",
      denserThanAir: false,
      characteristicDimensionM: null,
      richardsonNumber: null,
      reason: `Vapor density ${gasDensity.toFixed(3)} kg/m³ is not greater than air (${airDensity.toFixed(3)} kg/m³); ALOHA uses the Gaussian model for gases that are not denser than air.`,
    };
  }
  const H = Math.sqrt(input.releaseRateKgPerSec * Math.PI / (4 * gasDensity * input.windSpeed10mMps));
  const Ri = H * reducedGravity / (frictionVelocity * frictionVelocity);
  const heavy = Ri >= 1;
  return {
    ...base,
    model: heavy ? "heavy-gas" : "gaussian",
    denserThanAir: true,
    characteristicDimensionM: H,
    richardsonNumber: Ri,
    reason: heavy
      ? `Critical Richardson number ${Ri.toFixed(1)} is at least 1: the cloud is denser than air and gravity-dominated, so the Heavy Gas (DEGADIS) model applies.`
      : `Critical Richardson number ${Ri.toFixed(2)} is below 1: wind turbulence dominates, so ALOHA treats the gas as passive and uses the Gaussian model.`,
  };
}
