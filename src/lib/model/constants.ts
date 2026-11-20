export const MODEL_VERSION = "0.3.0-aloha-gaussian-degadis";
export const PLUME_MODEL_NAME = "HazMatIQ Gaussian dispersion model (ALOHA 5.4.4 documented method)";
export const PLUME_FORMULA_REFERENCE =
  "ALOHA 5.4.4 Technical Documentation, NOAA Technical Memorandum NOS OR&R 43 (2013), sections 4.2-4.5: Table 13 dispersion coefficients, Palazzi finite-duration Gaussian model, maximum-concentration threat zone, and confidence lines (https://response.restoration.noaa.gov/sites/default/files/ALOHA_Tech_Doc.pdf)";
export const PLUME_MODEL_LIMITATIONS = [
  "Neutrally buoyant gas only: idealized point source, Gaussian dispersion, level terrain, and wind that does not change with time or position.",
  "Does not model dense-gas slumping (ALOHA uses DEGADIS), inversions, terrain channeling, buildings, deposition, chemical reaction, fire, or thermodynamic source terms.",
  "Not applicable below 1 m/s wind at 10 m; source duration limited to 1 minute - 1 hour (ALOHA 1.2, 3.1).",
] as const;
export const BASELINE_PLUME_MODEL_METADATA = {
  modelName: "HazMatIQ Baseline Plume Planning Model",
  modelStatus: "Planning Estimate",
  validationStatus: "Not independently validated",
  formulaStatus: "Existing application plume calculation",
  formulaReference: PLUME_FORMULA_REFERENCE,
  limitations: [
    "Planning estimate only",
    "Not independently validated against published ALOHA comparison cases",
    "Weather source and observation time must be verified",
    "Does not replace field monitoring",
    "Does not replace official modeling",
    "Incident Command must verify tactical decisions",
    ...PLUME_MODEL_LIMITATIONS,
  ],
} as const;
export const PLUME_DISCLAIMER =
  "Calculated estimate using the Gaussian dispersion method published in the ALOHA 5.4.4 Technical Documentation; this is not NOAA's ALOHA software. Results depend on source-data quality and documented model limitations; confirm with an approved operational model such as ALOHA before safety decisions.";
