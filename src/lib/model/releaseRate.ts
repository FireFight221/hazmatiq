// Release-rate (source strength) screening calculator.
//
// Orifice discharge equations from Crowl & Louvar, "Chemical Process Safety:
// Fundamentals with Applications" (gas: Eq. 4-50 choked / 4-48 subsonic;
// liquid: Eq. 4-6) and the discharge-coefficient default used in EPA's Risk
// Management Program Guidance for Offsite Consequence Analysis (2009),
// Appendix D (Cd = 0.8). Results are a planning estimate only: they assume a
// round hole, steady tank pressure, and 100% of released mass airborne.

export const RELEASE_RATE_REFERENCES = Object.freeze([
  { name: "EPA RMP Guidance for Offsite Consequence Analysis (2009), Ch. 7 and Appendix D", url: "https://www.epa.gov/rmp/rmp-guidance-offsite-consequence-analysis" },
  { name: "Crowl & Louvar, Chemical Process Safety (3rd ed.), Ch. 4 orifice discharge", url: null },
]);

const R = 8.314462618; // J/(mol·K)
const G = 9.80665; // m/s²
const ATM_PA = 101325;
const PSI_TO_PA = 6894.757;
const IN_TO_M = 0.0254;
const FT_TO_M = 0.3048;
const KG_TO_LB = 2.2046226218;

export type ReleasePhase = "gas" | "liquid";

export type ReleaseRateInput = {
  phase: ReleasePhase;
  holeDiameterIn: number;
  /** Gauge pressure in the container (psig). For liquefied gases use the tank gauge or vapor pressure. */
  tankPressurePsig: number;
  /** Container (stored product) temperature, °F. Required for gas releases. */
  tankTempF?: number;
  /** Molecular weight, g/mol. Required for gas releases. */
  molecularWeight?: number;
  /** Heat-capacity ratio Cp/Cv. Defaults to 1.3 (conservative for most gases). */
  heatCapacityRatio?: number;
  /** Liquid density, g/cm³ (specific gravity). Required for liquid releases. */
  liquidDensityGcm3?: number;
  /** Liquid height above the hole, ft. Liquid releases only. */
  liquidHeadFt?: number;
  /** Discharge coefficient. Defaults to 0.8 (EPA RMP OCA guidance). */
  dischargeCoefficient?: number;
  /** Optional quantity available to release, lb, used to estimate duration. */
  availableQuantityLb?: number;
};

export type ReleaseRateResult = {
  ok: boolean;
  error?: string;
  phase: ReleasePhase;
  flowRegime?: "choked" | "subsonic" | "liquid";
  kgPerSec?: number;
  lbPerMin?: number;
  lbPerSec?: number;
  /** Minutes to release the available quantity at the initial rate (lower bound; real rate declines). */
  durationMinutes?: number | null;
  dischargeCoefficient?: number;
  assumptions: string[];
};

function positive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateReleaseRate(input: ReleaseRateInput): ReleaseRateResult {
  const assumptions = [
    "Round hole, steady container pressure: initial (maximum) release rate.",
    "100% of released mass treated as airborne (conservative for screening).",
    "Planning estimate only. Confirm container conditions and verify with air monitoring.",
  ];
  const phase: ReleasePhase = input.phase === "liquid" ? "liquid" : "gas";
  const diameterIn = positive(input.holeDiameterIn);
  if (!diameterIn) return { ok: false, phase, error: "Enter a hole diameter greater than zero.", assumptions };
  const gaugePsi = Number(input.tankPressurePsig);
  if (!Number.isFinite(gaugePsi) || gaugePsi < 0) return { ok: false, phase, error: "Enter container pressure in psig (0 or more).", assumptions };
  const cd = positive(input.dischargeCoefficient) ?? 0.8;
  if (cd > 1) return { ok: false, phase, error: "Discharge coefficient must be between 0 and 1.", assumptions };
  const areaM2 = Math.PI * ((diameterIn * IN_TO_M) / 2) ** 2;
  const gaugePa = gaugePsi * PSI_TO_PA;

  let kgPerSec: number;
  let flowRegime: ReleaseRateResult["flowRegime"];
  if (phase === "gas") {
    const mw = positive(input.molecularWeight);
    if (!mw) return { ok: false, phase, error: "Molecular weight is required for a gas release.", assumptions };
    const tempF = Number(input.tankTempF);
    if (!Number.isFinite(tempF)) return { ok: false, phase, error: "Container temperature is required for a gas release.", assumptions };
    const tempK = (tempF - 32) * (5 / 9) + 273.15;
    if (tempK <= 0) return { ok: false, phase, error: "Container temperature is below absolute zero.", assumptions };
    if (gaugePsi <= 0) return { ok: false, phase, error: "A gas release needs container pressure above atmospheric (psig > 0).", assumptions };
    const gamma = positive(input.heatCapacityRatio) ?? 1.3;
    if (gamma <= 1) return { ok: false, phase, error: "Heat-capacity ratio must be greater than 1.", assumptions };
    const molarMass = mw / 1000; // kg/mol
    const p0 = gaugePa + ATM_PA;
    const ratio = ATM_PA / p0;
    const criticalRatio = (2 / (gamma + 1)) ** (gamma / (gamma - 1));
    if (ratio <= criticalRatio) {
      flowRegime = "choked";
      kgPerSec = cd * areaM2 * p0 * Math.sqrt((gamma * molarMass) / (R * tempK) * (2 / (gamma + 1)) ** ((gamma + 1) / (gamma - 1)));
    } else {
      flowRegime = "subsonic";
      kgPerSec = cd * areaM2 * p0 * Math.sqrt(
        ((2 * molarMass) / (R * tempK)) * (gamma / (gamma - 1)) * (ratio ** (2 / gamma) - ratio ** ((gamma + 1) / gamma)),
      );
    }
    assumptions.push(`Ideal-gas orifice flow, heat-capacity ratio ${gamma}.`);
  } else {
    const densityGcm3 = positive(input.liquidDensityGcm3);
    if (!densityGcm3) return { ok: false, phase, error: "Liquid density is required for a liquid release.", assumptions };
    const rho = densityGcm3 * 1000; // kg/m³
    const headM = Math.max(0, Number(input.liquidHeadFt) || 0) * FT_TO_M;
    const drivingTerm = gaugePa / rho + G * headM;
    if (drivingTerm <= 0) return { ok: false, phase, error: "A liquid release needs container pressure or liquid height above the hole.", assumptions };
    flowRegime = "liquid";
    kgPerSec = cd * areaM2 * rho * Math.sqrt(2 * drivingTerm);
    assumptions.push("Bernoulli liquid orifice flow. Pressurized liquefied gases may flash to vapor and aerosol at the hole.");
  }

  const lbPerSec = kgPerSec * KG_TO_LB;
  const available = positive(input.availableQuantityLb);
  return {
    ok: true,
    phase,
    flowRegime,
    kgPerSec: round(kgPerSec, 4),
    lbPerSec: round(lbPerSec, 3),
    lbPerMin: round(lbPerSec * 60, 1),
    durationMinutes: available ? round(available / (lbPerSec * 60), 1) : null,
    dischargeCoefficient: cd,
    assumptions,
  };
}
