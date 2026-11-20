// Dense-gas screening for continuous ground-level releases using the
// Britter & McQuaid (1988) "Workbook on the Dispersion of Dense Gases"
// (HSE Contract Research Report 17/1988) correlation for continuous releases,
// in the curve-fit form tabulated by Crowl & Louvar (Chemical Process Safety).
//
//   g0' = g (rho0 - rhoa) / rhoa
//   Dc  = (q0 / u)^(1/2)
//   dense if (g0' q0 / (u^3 Dc))^(1/3) >= 0.15
//   alpha = 0.2 log10(g0'^2 q0 / u^5)
//   beta  = log10(x / Dc)   for Cm/C0 in 0.002 .. 0.1
//   near field (x <= 30 Dc): Cm/C0 = 306 (x/Dc)^-2 / (1 + 306 (x/Dc)^-2)
//
// Screening only. Flat terrain, no obstacles, isothermal; results are within
// roughly a factor of two of field trials per the workbook.

export const BRITTER_MCQUAID_REFERENCE = Object.freeze({
  name: "Britter & McQuaid (1988), Workbook on the Dispersion of Dense Gases, HSE CRR 17/1988",
  url: "https://www.nrc.gov/sites/default/files/ramp_files/codes/habit/documentation/technical-docs/Britter-McQuaid-CRR-17-1988.pdf",
});

const R = 8.314462618;
const G = 9.80665;
const AIR_MW = 28.96;
const ATM_PA = 101325;

type Segment = { max: number; slope: number; intercept: number };
// Each curve: piecewise-linear beta(alpha). The first segment applies for
// alpha <= its max; the last applies up to alpha = 1 (end of correlation).
const CURVES: ReadonlyArray<{ ratio: number; segments: Segment[] }> = [
  { ratio: 0.1, segments: [{ max: -0.55, slope: 0, intercept: 1.75 }, { max: -0.14, slope: 0.24, intercept: 1.88 }, { max: 1, slope: 0.5, intercept: 1.78 }] },
  { ratio: 0.05, segments: [{ max: -0.68, slope: 0, intercept: 1.92 }, { max: -0.29, slope: 0.36, intercept: 2.16 }, { max: -0.18, slope: 0, intercept: 2.06 }, { max: 1, slope: -0.56, intercept: 1.96 }] },
  { ratio: 0.02, segments: [{ max: -0.69, slope: 0, intercept: 2.08 }, { max: -0.31, slope: 0.45, intercept: 2.39 }, { max: -0.16, slope: 0, intercept: 2.25 }, { max: 1, slope: -0.54, intercept: 2.16 }] },
  { ratio: 0.01, segments: [{ max: -0.7, slope: 0, intercept: 2.25 }, { max: -0.29, slope: 0.49, intercept: 2.59 }, { max: -0.2, slope: 0, intercept: 2.45 }, { max: 1, slope: -0.52, intercept: 2.35 }] },
  { ratio: 0.005, segments: [{ max: -0.67, slope: 0, intercept: 2.4 }, { max: -0.28, slope: 0.59, intercept: 2.8 }, { max: -0.15, slope: 0, intercept: 2.63 }, { max: 1, slope: -0.49, intercept: 2.56 }] },
  { ratio: 0.002, segments: [{ max: -0.69, slope: 0, intercept: 2.6 }, { max: -0.25, slope: 0.39, intercept: 2.87 }, { max: -0.13, slope: 0, intercept: 2.77 }, { max: 1, slope: -0.5, intercept: 2.71 }] },
];

export function britterMcQuaidBeta(ratio: number, alpha: number): number | null {
  if (!(alpha <= 1)) return null;
  const evaluate = (curve: (typeof CURVES)[number]) => {
    const segment = curve.segments.find((candidate) => alpha <= candidate.max) ?? curve.segments[curve.segments.length - 1];
    return segment.slope * alpha + segment.intercept;
  };
  const exact = CURVES.find((curve) => Math.abs(curve.ratio - ratio) < 1e-12);
  if (exact) return evaluate(exact);
  // Interpolate between neighbouring curves linearly in log10(Cm/C0).
  for (let index = 0; index < CURVES.length - 1; index += 1) {
    const upper = CURVES[index];
    const lower = CURVES[index + 1];
    if (ratio < upper.ratio && ratio > lower.ratio) {
      const t = (Math.log10(ratio) - Math.log10(upper.ratio)) / (Math.log10(lower.ratio) - Math.log10(upper.ratio));
      return evaluate(upper) + t * (evaluate(lower) - evaluate(upper));
    }
  }
  return null;
}

export type DenseGasLevel = { id: string; label: string; volumeFraction: number };

export type DenseGasInput = {
  releaseRateKgPerSec: number;
  molecularWeight: number;
  windSpeedMps: number;
  ambientTempC: number;
  /** Temperature of the released vapor (e.g. boiling point for a flashing liquefied gas). Defaults to ambient. */
  sourceTempC?: number;
  releaseDurationSec?: number;
  levels: DenseGasLevel[];
};

export type DenseGasLevelResult = DenseGasLevel & {
  distanceM: number | null;
  method: "near-field" | "correlation" | null;
  note?: string;
};

export type DenseGasResult = {
  applicable: boolean;
  reason: string;
  densityRatio: number | null;
  richardsonCriterion: number | null;
  alpha: number | null;
  sourceDimensionM: number | null;
  levels: DenseGasLevelResult[];
  reference: typeof BRITTER_MCQUAID_REFERENCE;
  limitations: string[];
};

const LIMITATIONS = [
  "Britter–McQuaid workbook correlation: flat, unobstructed terrain; accuracy about a factor of two.",
  "Valid for concentrations 0.2%–10% (2,000–100,000 ppm). Below 0.2% the cloud behaves like a neutral gas and the Gaussian plume governs.",
  "Cold vapor, aerosol, terrain channeling, and low-lying pooling can extend the hazard; confirm with monitoring.",
];

export function denseGasScreen(input: DenseGasInput): DenseGasResult {
  const base = { reference: BRITTER_MCQUAID_REFERENCE, limitations: LIMITATIONS };
  const empty = (reason: string): DenseGasResult => ({ applicable: false, reason, densityRatio: null, richardsonCriterion: null, alpha: null, sourceDimensionM: null, levels: input.levels.map((level) => ({ ...level, distanceM: null, method: null })), ...base });
  const rate = Number(input.releaseRateKgPerSec);
  const mw = Number(input.molecularWeight);
  const u = Number(input.windSpeedMps);
  const ambientK = Number(input.ambientTempC) + 273.15;
  const sourceK = (Number.isFinite(Number(input.sourceTempC)) ? Number(input.sourceTempC) : Number(input.ambientTempC)) + 273.15;
  if (!(rate > 0) || !(mw > 0) || !(u > 0) || !(ambientK > 0) || !(sourceK > 0)) return empty("Release rate, molecular weight, wind speed, and temperature are required.");
  const rhoA = (ATM_PA * (AIR_MW / 1000)) / (R * ambientK);
  const rho0 = (ATM_PA * (mw / 1000)) / (R * sourceK);
  const densityRatio = rho0 / rhoA;
  if (densityRatio <= 1) return { ...empty("Vapor is not heavier than air at release temperature; neutral/buoyant dispersion applies."), densityRatio };
  const g0 = (G * (rho0 - rhoA)) / rhoA;
  const q0 = rate / rho0;
  const dc = Math.sqrt(q0 / u);
  const criterion = ((g0 * q0) / (u ** 3 * dc)) ** (1 / 3);
  const alpha = 0.2 * Math.log10((g0 ** 2 * q0) / u ** 5);
  if (criterion < 0.15) {
    return { ...empty(`Dense-gas criterion ${criterion.toFixed(2)} < 0.15: density effects are negligible at this wind speed; neutral-gas plume applies.`), densityRatio, richardsonCriterion: criterion, alpha, sourceDimensionM: dc };
  }
  if (alpha > 1) {
    return { ...empty(`Outside workbook range (alpha ${alpha.toFixed(2)} > 1: very dense release or very light wind). Treat as a large dense cloud and request specialist modeling.`), densityRatio, richardsonCriterion: criterion, alpha, sourceDimensionM: dc };
  }
  const duration = Number(input.releaseDurationSec);
  const levels = input.levels.map((level): DenseGasLevelResult => {
    const ratio = Number(level.volumeFraction);
    if (!(ratio > 0) || ratio >= 1) return { ...level, distanceM: null, method: null, note: "Invalid concentration." };
    if (ratio < 0.002) return { ...level, distanceM: null, method: null, note: "Below 0.2%: outside dense-gas range; use the Gaussian plume result." };
    let distanceM: number;
    let method: DenseGasLevelResult["method"];
    if (ratio > 0.1) {
      // Near-field relation, valid out to 30 Dc.
      const y = ratio / (306 * (1 - ratio));
      distanceM = dc / Math.sqrt(y);
      method = "near-field";
      if (distanceM > 30 * dc) return { ...level, distanceM: null, method: null, note: "Near-field relation out of range." };
    } else {
      const beta = britterMcQuaidBeta(ratio, alpha);
      if (beta === null) return { ...level, distanceM: null, method: null, note: "Outside correlation range." };
      distanceM = dc * 10 ** beta;
      method = "correlation";
    }
    let note: string | undefined;
    if (duration > 0 && (u * duration) / distanceM < 2.5) note = "Release may be too short to reach steady state at this distance (u·T/x < 2.5); distance may be overstated.";
    return { ...level, distanceM: Math.round(distanceM), method, note };
  });
  return {
    applicable: true,
    reason: `Heavier-than-air cloud (density ${densityRatio.toFixed(2)}× air, criterion ${criterion.toFixed(2)} ≥ 0.15).`,
    densityRatio,
    richardsonCriterion: criterion,
    alpha,
    sourceDimensionM: dc,
    levels,
    ...base,
  };
}

/**
 * Wind-direction uncertainty half-angle (degrees) for the confidence lines
 * drawn either side of the downwind axis. Wider in light winds, where wind
 * direction wanders more, after the approach of NOAA ALOHA's wind-direction
 * confidence lines. Screening approximation, not the ALOHA formula.
 */
export function windShiftHalfAngleDeg(windSpeedMps: number): number {
  const u = Number(windSpeedMps);
  if (!(u > 0)) return 180;
  if (u <= 1) return 180; // ALOHA User's Manual: lines form a circle near 1 m/s
  if (u < 1.5) return 60;
  if (u < 2) return 45;
  if (u < 3) return 30;
  if (u < 5) return 22.5;
  return 15;
}
