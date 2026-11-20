import type { PlumeCalculationEvidence, PlumeInputs, PlumeResult, ThresholdBand } from "@/lib/schema";
import { mgM3ToPpm, ppmToMgM3 } from "@/lib/schema";
import { pickRoughness } from "./briggs";
import {
  ALOHA_MIN_WIND_SPEED_10M_MPS,
  ALOHA_MIN_RELEASE_DURATION_SEC,
  ALOHA_TYPICAL_MAX_RANGE_M,
  ALOHA_TYPICAL_MIN_RANGE_M,
  alohaConfidenceHalfAngleDeg,
  alohaCrosswindHalfWidth,
  alohaMaxConcentration,
  clampReleaseDuration,
  type AlohaGaussianSource,
} from "./alohaMethod";
import {
  BASELINE_PLUME_MODEL_METADATA,
  MODEL_VERSION,
  PLUME_DISCLAIMER,
  PLUME_FORMULA_REFERENCE,
  PLUME_MODEL_LIMITATIONS,
  PLUME_MODEL_NAME,
} from "./constants";

export interface RunPlumeOptions {
  thresholds: ThresholdBand[];
  calculationEvidence?: PlumeCalculationEvidence;
  saturatedConcentrationPpm?: number;
  emissionRateKgPerSec?: number;
  totalMassKg?: number;
  maxRangeM?: number;
  molecularWeight?: number;
  /** Continuous-release duration, s. ALOHA limits sources to 60 s - 3600 s; default 3600 s. */
  releaseDurationSec?: number | null;
}

const TWO_PI = 2 * Math.PI;
const SQRT_2PI_LN2 = Math.sqrt(2 * Math.log(2));

/**
 * Returns concentration in kg/m³ at (x, y, z) for a continuous point source.
 * For ppm conversion use mgM3ToPpm with molecular weight and temperature.
 */
export function gaussianPlumeC(
  inputs: PlumeInputs,
  x: number,
  y: number,
  z: number,
  emissionRateKgPerSec: number,
): number {
  if (x <= 0) return 0;
  const u = Math.max(inputs.windSpeedMps, 0.1);
  const { sigmaY, sigmaZ } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const sy = Math.max(sigmaY(x), 1e-3);
  const sz = Math.max(sigmaZ(x), 1e-3);
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  const expGround = Math.exp(-((z + inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (emissionRateKgPerSec / (u * sy * sz * TWO_PI)) * expY * (expZ + expGround);
}

export function gaussianPuffC(
  inputs: PlumeInputs,
  x: number,
  y: number,
  z: number,
  totalMassKg: number,
  t: number,
): number {
  if (t <= 0) return 0;
  const u = Math.max(inputs.windSpeedMps, 0.1);
  const { sigmaY, sigmaZ } = pickRoughness(inputs.stabilityClass, inputs.surfaceRoughness);
  const travelDistance = u * t;
  const sx = Math.max(sigmaY(travelDistance), 1e-3);
  const sy = Math.max(sigmaY(travelDistance), 1e-3);
  const sz = Math.max(sigmaZ(travelDistance), 1e-3);
  const expX = Math.exp(-((x - u * t) ** 2) / (2 * sx * sx));
  const expY = Math.exp(-(y * y) / (2 * sy * sy));
  const expZ = Math.exp(-((z - inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  const expGround = Math.exp(-((z + inputs.releaseHeightM) ** 2) / (2 * sz * sz));
  return (totalMassKg / Math.pow(TWO_PI, 1.5) / (sx * sy * sz)) * expX * expY * (expZ + expGround);
}

export function runPlume(inputs: PlumeInputs, opts: RunPlumeOptions): PlumeResult {
  const computedAt = new Date().toISOString();
  const isPlume = inputs.releaseKind === "plume";
  const Q = opts.emissionRateKgPerSec ?? inputs.releaseRateKgPerSec;
  const M = opts.totalMassKg ?? inputs.totalMassKg;
  const maxRange = opts.maxRangeM ?? ALOHA_TYPICAL_MAX_RANGE_M;
  const xSamples = 60;
  const xStep = maxRange / xSamples;
  const mw = opts.molecularWeight ?? inputs.molecularWeight;
  const requiredEvidence = [
    "chemicalId", "releaseKind", "releaseHeightM", "windSpeedMps", "windDirDeg",
    "stabilityClass", "surfaceRoughness", "tempC", "molecularWeight", "thresholds",
    isPlume ? "releaseRateKgPerSec" : "totalMassKg",
  ];
  const calculationEvidence = opts.calculationEvidence;
  if (calculationEvidence) {
    const evidencedFields = new Set(calculationEvidence.sourceData
      .filter((record) => record.approved === true)
      .flatMap((record) => record.fields.filter((field) => field in record.values)));
    const missingEvidence = requiredEvidence.filter((field) => !evidencedFields.has(field));
    if (missingEvidence.length) throw new Error(`Missing approved plume source records for: ${missingEvidence.join(", ")}`);
  }
  if (!Number.isFinite(mw) || mw! <= 0) throw new Error("Molecular weight is required and must be positive; no default may be inferred.");
  if (!Number.isFinite(inputs.windSpeedMps) || inputs.windSpeedMps <= 0) throw new Error("A positive wind speed is required.");
  if (inputs.windSpeedMps < ALOHA_MIN_WIND_SPEED_10M_MPS) {
    throw new Error("Wind speed is below 1 m/s (2.2 mph) at 10 m. Gaussian dispersion (and ALOHA) is not applicable in calm or very light wind; use ERG distances and air monitoring.");
  }
  if (!Number.isFinite(inputs.windDirDeg) || inputs.windDirDeg < 0 || inputs.windDirDeg > 360) throw new Error("Wind direction must be between 0 and 360 degrees.");
  if (!Number.isFinite(inputs.releaseHeightM) || inputs.releaseHeightM < 0) throw new Error("Release height must be zero or greater.");
  if (!Number.isFinite(inputs.tempC) || inputs.tempC <= -273.15) throw new Error("Air temperature must be above absolute zero.");
  if (!Number.isFinite(maxRange) || maxRange <= 0) throw new Error("Computational range must be positive.");
  if (isPlume && (!Number.isFinite(Q) || Q! <= 0)) throw new Error("A positive release rate is required for a continuous plume; no default may be inferred.");
  if (!isPlume && (!Number.isFinite(M) || M! <= 0)) throw new Error("A positive total mass is required for a puff; no default may be inferred.");
  if (!opts.thresholds.length) throw new Error("At least one approved exposure threshold is required; no default may be inferred.");
  if (opts.thresholds.some((threshold) => !Number.isFinite(threshold.valuePpm) || threshold.valuePpm <= 0)) {
    throw new Error("Every exposure threshold must be a positive finite concentration.");
  }
  const calculatedInputValues: Record<string, unknown> = {
    ...inputs,
    molecularWeight: mw,
    thresholds: opts.thresholds,
    ...(isPlume ? { releaseRateKgPerSec: Q } : { totalMassKg: M }),
  };
  if (calculationEvidence) {
    const mismatchedEvidence = requiredEvidence.filter((field) => !calculationEvidence.sourceData.some((record) =>
      record.approved === true
      && record.fields.includes(field)
      && JSON.stringify(record.values[field]) === JSON.stringify(calculatedInputValues[field])));
    if (mismatchedEvidence.length) {
      throw new Error(`Plume inputs do not match approved source records for: ${mismatchedEvidence.join(", ")}`);
    }
  }

  // ALOHA 4.3: an instantaneous release is a single one-minute steady-state
  // release; a continuous release is a steady-state release of finite duration
  // (up to one hour), dispersed with the Palazzi short-duration Gaussian model.
  const releaseDurationSec = isPlume ? clampReleaseDuration(opts.releaseDurationSec) : ALOHA_MIN_RELEASE_DURATION_SEC;
  const source: AlohaGaussianSource = {
    releaseRateKgPerSec: isPlume ? Q! : M! / ALOHA_MIN_RELEASE_DURATION_SEC,
    releaseDurationSec,
    windSpeedMps: inputs.windSpeedMps,
    stabilityClass: inputs.stabilityClass,
    surface: inputs.surfaceRoughness === "urban" ? "urban" : "rural",
    releaseHeightM: inputs.releaseHeightM,
  };
  // ALOHA 4.5.1: threat zones use the maximum ground-level concentration over all time.
  const peak = (x: number) => alohaMaxConcentration(source, x, 0, 0);

  const targetMgM3ByKind = new Map<string, number>();
  for (const b of opts.thresholds) {
    targetMgM3ByKind.set(`${b.kind}-${b.level}`, ppmToMgM3(b.valuePpm, mw!, inputs.tempC));
  }
  const thresholdTarget = (kind: string, level: number): number => {
    const v = targetMgM3ByKind.get(`${kind}-${level}`);
    if (v !== undefined) return v;
    throw new Error(`No source threshold exists for ${kind}-${level}.`);
  };

  const centerline: PlumeResult["centerline"] = [];
  for (let i = 1; i <= xSamples; i++) {
    const x = i * xStep;
    centerline.push({
      distanceM: Math.round(x),
      concentrationPpm: Number(mgM3ToPpm(peak(x) * 1e6, mw!, inputs.tempC).toFixed(4)),
    });
  }

  // Log-spaced scan from 1 m to the computational range to bracket the LOC.
  const scan: number[] = [];
  const scanCount = 240;
  const minX = Math.min(1, maxRange / 1000);
  for (let i = 0; i <= scanCount; i++) scan.push(minX * Math.pow(maxRange / minX, i / scanCount));

  const isopleths = opts.thresholds.map((band) => {
    const targetKgM3 = thresholdTarget(band.kind, band.level) / 1e6;
    const inside = scan.map((x) => peak(x) >= targetKgM3);
    const firstInside = inside.indexOf(true);
    const finalCenterlineKgM3 = peak(maxRange);
    const rangeTruncated = finalCenterlineKgM3 >= targetKgM3;
    if (firstInside === -1) {
      return { thresholdKind: band.kind, thresholdLevel: band.level, polygon: [], maxDownwindM: 0, maxCrosswindM: 0, rangeTruncated: false };
    }
    let lastInside = inside.lastIndexOf(true);
    // ALOHA 4.5.2: binary search of the maximum-concentration function for the downwind LOC distance.
    const bisect = (insideX: number, outsideX: number) => {
      let low = insideX;
      let high = outsideX;
      for (let iteration = 0; iteration < 50; iteration++) {
        const middle = (low + high) / 2;
        if (peak(middle) >= targetKgM3) low = middle;
        else high = middle;
      }
      return (low + high) / 2;
    };
    const xEnd = rangeTruncated || lastInside === scan.length - 1 ? maxRange : bisect(scan[lastInside], scan[lastInside + 1]);
    const xStart = firstInside === 0 ? 0 : bisect(scan[firstInside], scan[firstInside - 1]);
    if (lastInside < firstInside) lastInside = firstInside;
    const pts: Array<[number, number]> = [];
    let maxY = 0;
    const contourPoints = 60;
    if (xStart > 0) pts.push([xStart, 0]);
    for (let i = 1; i < contourPoints; i++) {
      const x = xStart + ((xEnd - xStart) * i) / contourPoints;
      const y = alohaCrosswindHalfWidth(source, x, peak(x), targetKgM3);
      if (y > maxY) maxY = y;
      pts.push([x, y]);
    }
    if (rangeTruncated) {
      const y = alohaCrosswindHalfWidth(source, xEnd, peak(xEnd), targetKgM3);
      if (y > maxY) maxY = y;
      pts.push([xEnd, y]);
    } else {
      pts.push([xEnd, 0]);
    }
    return {
      thresholdKind: band.kind,
      thresholdLevel: band.level,
      polygon: buildClosedPolygon(pts),
      maxDownwindM: xEnd,
      maxCrosswindM: maxY,
      rangeTruncated,
    };
  });

  const rangeTruncated = isopleths.some((isopleth) => isopleth.rangeTruncated);
  const shortZones = isopleths.some((isopleth) => isopleth.maxDownwindM > 0 && isopleth.maxDownwindM < ALOHA_TYPICAL_MIN_RANGE_M);
  const resultLimitations = [
    ...BASELINE_PLUME_MODEL_METADATA.limitations,
    ...(rangeTruncated ? [
      `One or more AEGL isopleths reach the ${maxRange} m computational boundary; the reported distance is a lower bound, not a modeled endpoint.`,
    ] : []),
    ...(shortZones ? [
      "One or more threat zones are shorter than 100 m. ALOHA's method is designed for threat zones of 100 to 10,000 m; near-source results are less reliable, and the ERG initial isolation distance should govern.",
    ] : []),
    ...(isPlume && (opts.releaseDurationSec === undefined || opts.releaseDurationSec === null)
      ? ["Release duration not entered: modeled as a one-hour continuous release (ALOHA maximum)."]
      : []),
    `Threat zones use the maximum ground-level concentration over time (ALOHA 4.5.1); downwind endpoints are solved by bisection and centerline values are reported every ${Number(xStep.toFixed(3))} m.`,
  ];

  return {
    status: "Calculated estimate",
    modelVersion: MODEL_VERSION,
    modelName: BASELINE_PLUME_MODEL_METADATA.modelName,
    modelStatus: BASELINE_PLUME_MODEL_METADATA.modelStatus,
    validationStatus: BASELINE_PLUME_MODEL_METADATA.validationStatus,
    validated: false,
    inputs,
    isopleths,
    centerline,
    thresholdsUsed: opts.thresholds,
    computationalRangeM: maxRange,
    samplingIntervalM: xStep,
    computedAt,
    modelMetadata: {
      ...BASELINE_PLUME_MODEL_METADATA,
      limitations: [...BASELINE_PLUME_MODEL_METADATA.limitations],
    },
    ...(calculationEvidence ? {
      calculation: {
        ...calculationEvidence,
        modelName: PLUME_MODEL_NAME,
        formulaReference: PLUME_FORMULA_REFERENCE,
        limitations: [...new Set([...PLUME_MODEL_LIMITATIONS, ...calculationEvidence.limitations])],
      },
    } : {}),
    limitations: resultLimitations,
    disclaimer: PLUME_DISCLAIMER,
  };
}

/** ALOHA 4.5.3 confidence-line half angle for the run's wind and stability. */
export function plumeConfidenceHalfAngleDeg(inputs: Pick<PlumeInputs, "windSpeedMps" | "stabilityClass">): number {
  return alohaConfidenceHalfAngleDeg(inputs.windSpeedMps, inputs.stabilityClass);
}

function buildClosedPolygon(upperEdge: Array<[number, number]>): Array<[number, number]> {
  if (upperEdge.length === 0) return [];
  const lowerEdge: Array<[number, number]> = [...upperEdge].reverse().map(([x, y]) => [x, -y]);
  return [...upperEdge, ...lowerEdge];
}

export function isoplethCentroid(
  polygon: Array<[number, number]>,
): [number, number] | null {
  if (polygon.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let sa = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const cross = x1 * y2 - x2 * y1;
    sa += cross;
    sx += (x1 + x2) * cross;
    sy += (y1 + y2) * cross;
  }
  if (sa === 0) return null;
  return [sx / (3 * sa), sy / (3 * sa)];
}

export const HALF_WIDTH_AT_HALF_MAX = SQRT_2PI_LN2;
