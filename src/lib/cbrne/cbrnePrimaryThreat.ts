/*
 * Primary threat statement for the CBRNE Hazard Profile "Immediate Threat"
 * card. Responders read this line first, so it leads with the agent class in
 * capitals followed by one plain-language effect statement, e.g.
 *   NERVE AGENT  Exposure leads to nervous-system disruption and may become
 *                fatal within minutes.
 *
 * The lead line is a class-level statement (CHEMM / CDC category wording,
 * labelled as a class summary requiring SME review). Imported source facts
 * are NEVER rewritten: when an agent-specific HAZARDS fact exists it is
 * returned unchanged as `agentSourceFact` and displayed verbatim beneath the
 * lead line. If no class statement exists, the agent fact is the lead. Class statements paraphrase
 * the CHEMM and CDC agent-category descriptions; they do not replace an
 * agent-specific source fact.
 */
import type { CbrneSourceFact } from "./cbrneTypes.js";

export type CbrnePrimaryThreat = {
  classLabel: string;
  statement: string;
  basis: "AGENT_SOURCE_FACT" | "CLASS_SUMMARY";
  sourceName: string;
  sourceUrl: string | null;
  verificationStatus: string;
  factId: string | null;
  agentSourceFact: { id: string; fieldName: string; value: string; sourceName: string; verificationStatus: string } | null;
};

type ClassStatement = { statement: string; sourceName: string; sourceUrl: string };

const CHEMM = "Chemical Hazards Emergency Medical Management";
const CDC_BT = "CDC MMWR — Biological and Chemical Terrorism: Strategic Plan (critical biological agents)";

const CLASS_STATEMENTS: Readonly<Record<string, ClassStatement>> = Object.freeze({
  NERVE_AGENT: {
    statement: "Exposure leads to nervous-system disruption and may become fatal within minutes.",
    sourceName: CHEMM,
    sourceUrl: "https://www.chemm.hhs.gov/dictionary",
  },
  FOURTH_GENERATION_AGENT: {
    statement: "Exposure leads to nervous-system disruption like other nerve agents, with greater persistence; may become fatal within minutes.",
    sourceName: CHEMM,
    sourceUrl: "https://www.chemm.hhs.gov/dictionary",
  },
  BLISTER_AGENT: {
    statement: "Exposure burns and blisters the eyes, skin, and airway; mustard effects can be delayed for hours, while lewisite and phosgene oxime cause immediate pain.",
    sourceName: CHEMM,
    sourceUrl: "https://chemm.hhs.gov/blisteragents.htm",
  },
  BLOOD_AGENT: {
    statement: "Exposure blocks the body's use of oxygen and can cause collapse, seizures, and death within minutes at high concentrations.",
    sourceName: CHEMM,
    sourceUrl: "https://chemm.hhs.gov/bloodagents.htm",
  },
  CHOKING_AGENT: {
    statement: "Exposure injures the airway and lungs; fluid in the lungs (pulmonary edema) can develop hours after an apparently mild exposure.",
    sourceName: CHEMM,
    sourceUrl: "https://www.chemm.hhs.gov/dictionary",
  },
  BIOLOGICAL_TOXIN: {
    statement: "Exposure can cause severe, potentially fatal illness; onset may be delayed hours to days, and inhalation is the most dangerous route.",
    sourceName: CDC_BT,
    sourceUrl: "https://www.cdc.gov/mmwr/preview/mmwrhtml/rr4904a1.htm",
  },
  BACTERIAL_AGENT: {
    statement: "Infection can cause severe illness after an incubation period of days; early symptoms are often delayed and flu-like.",
    sourceName: CDC_BT,
    sourceUrl: "https://www.cdc.gov/mmwr/preview/mmwrhtml/rr4904a1.htm",
  },
  VIRAL_AGENT: {
    statement: "Infection can cause severe, potentially contagious illness after an incubation period; apply infection-control precautions and notify public health.",
    sourceName: CDC_BT,
    sourceUrl: "https://www.cdc.gov/mmwr/preview/mmwrhtml/rr4904a1.htm",
  },
});

export function cbrneClassLabel(category: string | null | undefined): string {
  return String(category || "Unknown agent").replace(/_/g, " ").trim().toLocaleUpperCase();
}

function normalizedCategoryKey(category: string | null | undefined) {
  return String(category || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function cbrneClassStatement(category: string | null | undefined): ClassStatement | null {
  return CLASS_STATEMENTS[normalizedCategoryKey(category)] ?? null;
}

export function cbrnePrimaryThreat(
  category: string | null | undefined,
  hazardFacts: readonly CbrneSourceFact[] = [],
): CbrnePrimaryThreat | null {
  const classLabel = cbrneClassLabel(category);
  const agentFact = hazardFacts.find((fact) => fact.fieldGroup === "HAZARDS"
    && fact.value !== null && String(fact.value).trim());
  const agentSourceFact = agentFact ? {
    id: agentFact.id,
    fieldName: agentFact.fieldName,
    value: String(agentFact.value),
    sourceName: agentFact.sourceName,
    verificationStatus: agentFact.verificationStatus,
  } : null;
  const summary = cbrneClassStatement(category);
  if (summary) {
    return {
      classLabel,
      statement: summary.statement,
      basis: "CLASS_SUMMARY",
      sourceName: summary.sourceName,
      sourceUrl: summary.sourceUrl,
      verificationStatus: "Requires SME Review",
      factId: agentFact?.id ?? null,
      agentSourceFact,
    };
  }
  if (!agentFact) return null;
  return {
    classLabel,
    statement: String(agentFact.value),
    basis: "AGENT_SOURCE_FACT",
    sourceName: agentFact.sourceName,
    sourceUrl: agentFact.sourceUrl ?? null,
    verificationStatus: agentFact.verificationStatus,
    factId: agentFact.id,
    agentSourceFact,
  };
}
