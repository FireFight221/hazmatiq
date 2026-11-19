import type { CbrneCategory } from "./cbrneTypes.js";

// ERG 2024 moved chemical warfare agents out of Table 1 into the "Criminal or
// Terrorist Use of Chemical, Biological and Radiological Agents" section, with a
// single Initial Isolation and Protective Action Distances table per agent type.
// Source: PHMSA ERG 2024 technical documentation, Table A.1 (chemical warfare
// agents), https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2025-05/ERG2024-v10.pdf
// Nerve agents use the Sarin values (ERG 2024).
export type ErgCwaReference = {
  agentType: string;
  guide: string;
  initialIsolationM: number;
  smallReleaseKm: number;
  largeReleaseKm: number;
  source: string;
};

const SOURCE = "PHMSA ERG 2024 · Chemical Warfare Agents table";

const ERG_CWA_TABLE: Partial<Record<CbrneCategory, ErgCwaReference>> = {
  NERVE_AGENT: { agentType: "Nerve agents", guide: "153", initialIsolationM: 400, smallReleaseKm: 1.0, largeReleaseKm: 4.0, source: SOURCE },
  FOURTH_GENERATION_AGENT: { agentType: "Nerve agents", guide: "153", initialIsolationM: 400, smallReleaseKm: 1.0, largeReleaseKm: 4.0, source: SOURCE },
  BLISTER_AGENT: { agentType: "Blister agents", guide: "153", initialIsolationM: 200, smallReleaseKm: 0.4, largeReleaseKm: 1.6, source: SOURCE },
  BLOOD_AGENT: { agentType: "Blood agents", guide: "117", initialIsolationM: 400, smallReleaseKm: 0.9, largeReleaseKm: 3.2, source: SOURCE },
  CHOKING_AGENT: { agentType: "Choking agents", guide: "125", initialIsolationM: 100, smallReleaseKm: 0.3, largeReleaseKm: 1.1, source: SOURCE },
  INCAPACITATING_AGENT: { agentType: "Incapacitating agents", guide: "153", initialIsolationM: 1000, smallReleaseKm: 1.7, largeReleaseKm: 7.8, source: SOURCE },
  RIOT_CONTROL_AGENT: { agentType: "Tear gas agents", guide: "159", initialIsolationM: 30, smallReleaseKm: 0.2, largeReleaseKm: 0.6, source: SOURCE },
};

export function ergCwaReference(category: CbrneCategory | string | undefined): ErgCwaReference | null {
  return (category && ERG_CWA_TABLE[category as CbrneCategory]) || null;
}

export function ergCwaSummary(reference: ErgCwaReference | null): string | null {
  if (!reference) return null;
  return `Isolate ${reference.initialIsolationM} m · Protect downwind ${reference.smallReleaseKm} km small / ${reference.largeReleaseKm} km large (ERG 2024 CWA table)`;
}
