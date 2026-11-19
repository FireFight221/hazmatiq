export const PLUME_MODEL_FAMILIES = [
  "Gaussian neutral gas",
  "Heavy gas / dense gas",
  "Continuous release",
  "Instantaneous / puff release",
  "Pool evaporation",
  "Jet release",
  "Fire/explosion scenario",
  "ERG overlay only",
  "No model available",
] as const;

export type PlumeModelFamily = typeof PLUME_MODEL_FAMILIES[number];

export interface PlumeModelSelectorInput {
  releaseKind?: "plume" | "puff" | null;
  sourceType?: string | null;
  vaporDensityAir?: number | null;
  denseGasKnown?: boolean;
  ergOverlayOnly?: boolean;
  fireOrExplosion?: boolean;
}

export interface PlumeModelSelection {
  modelFamily: PlumeModelFamily;
  releasePattern: "Continuous release" | "Instantaneous / puff release" | "Requires Review";
  calculationApproach: string;
  status: "Planning Estimate" | "Requires Review" | "Overlay Only" | "No Model Available";
  supported: boolean;
  assumptions: string[];
  limitations: string[];
}

export function selectPlumeModelFamily(input: PlumeModelSelectorInput): PlumeModelSelection {
  const releasePattern = input.releaseKind === "plume"
    ? "Continuous release"
    : input.releaseKind === "puff" ? "Instantaneous / puff release" : "Requires Review";
  if (input.ergOverlayOnly) return {
    modelFamily: "ERG overlay only", releasePattern, calculationApproach: "No dispersion calculation",
    status: "Overlay Only", supported: true, assumptions: [], limitations: ["ERG distances are not plume-model concentration contours."],
  };
  if (input.fireOrExplosion || /fire|explosion/i.test(input.sourceType || "")) return {
    modelFamily: "Fire/explosion scenario", releasePattern, calculationApproach: "No model available",
    status: "No Model Available", supported: false, assumptions: [], limitations: ["Fire and explosion source terms are not supported."],
  };
  if (/puddle|pool/i.test(input.sourceType || "")) return {
    modelFamily: "Pool evaporation", releasePattern, calculationApproach: "Gaussian dispersion requires an operator-provided source strength",
    status: "Planning Estimate", supported: false, assumptions: ["Operator-provided release rate is used without a pool-evaporation calculation."], limitations: ["Pool evaporation is not calculated or validated."],
  };
  if (/jet/i.test(input.sourceType || "")) return {
    modelFamily: "Jet release", releasePattern, calculationApproach: "Gaussian dispersion requires an operator-provided source strength",
    status: "Planning Estimate", supported: false, assumptions: ["Operator-provided release rate is used without a jet source-term calculation."], limitations: ["Jet momentum and thermodynamics are not modeled."],
  };
  const dense = input.denseGasKnown === true
    || (typeof input.vaporDensityAir === "number" && Number.isFinite(input.vaporDensityAir) && input.vaporDensityAir > 1);
  if (dense) return {
    modelFamily: "Heavy gas / dense gas",
    releasePattern,
    calculationApproach: "Neutral-gas Gaussian screening only — dense-gas physics are NOT applied",
    status: "Requires Review",
    supported: false,
    assumptions: [
      "Product vapor is heavier than air, but the footprint is drawn with the neutral-gas Gaussian calculation.",
    ],
    limitations: [
      "Dense gas behavior is not explicitly modeled: gravity slumping, upwind/crosswind spreading, and flow into low terrain are not calculated.",
      "Near the source and in low-lying areas, a dense-gas cloud can be wider and more concentrated than this footprint shows. Confirm with air monitoring and a dense-gas model (for example ALOHA heavy gas) before relying on these distances.",
    ],
  };
  const densityKnown = typeof input.vaporDensityAir === "number" && Number.isFinite(input.vaporDensityAir);
  return {
    modelFamily: input.releaseKind === "puff" ? "Instantaneous / puff release" : "Gaussian neutral gas",
    releasePattern,
    calculationApproach: "Gaussian plume/puff screening calculation",
    status: densityKnown ? "Planning Estimate" : "Requires Review",
    supported: true,
    assumptions: ["Neutral-gas Gaussian dispersion", "Level terrain", "Constant meteorology"],
    limitations: densityKnown ? [] : ["Vapor-density behavior is not confirmed; model-family applicability requires review."],
  };
}
