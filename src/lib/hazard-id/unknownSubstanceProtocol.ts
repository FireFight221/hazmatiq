import type { HazardProfile, HazardSearchResult, HazardSourceFact } from "./hazardTypes.js";

/**
 * Unknown substance / suspicious powder initial-response protocol.
 *
 * Every fact below is quoted verbatim from a published U.S. government source
 * (PHMSA ERG 2024 Guide 111; FBI-DHS-HHS/CDC coordinated guidance; OSHA
 * 29 CFR 1910.120 Appendix B). Nothing here is derived, estimated, or
 * paraphrased into new hazard values, and nothing in data/ or src/data/ is
 * modified. The profile deliberately does not select a PPE level: OSHA's
 * criteria are shown so the Safety Officer / IC makes that decision.
 */
export const UNKNOWN_SUBSTANCE_ID = "unknown-suspicious-substance";

const ERG = {
  sourceRegistryId: "PHMSA_ERG_2024",
  sourceName: "PHMSA Emergency Response Guidebook 2024 — Guide 111",
  sourceDocumentTitle: "2024 Emergency Response Guidebook, Guide 111: Mixed Load/Unidentified Cargo",
  sourceUrl: "https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2024-04/ERG2024-Eng-Web-a.pdf",
};
const FBI = {
  sourceRegistryId: "FBI_DHS_CDC_SUSPICIOUS_LETTER_2004",
  sourceName: "FBI – DHS – HHS/CDC Coordinated Guidance (Nov 2, 2004)",
  sourceDocumentTitle: "Guidance on Initial Responses to a Suspicious Letter/Container With a Potential Biological Threat",
  sourceUrl: "https://stacks.cdc.gov/view/cdc/44088/cdc_44088_DS1.pdf",
};
const OSHA = {
  sourceRegistryId: "OSHA_1910_120_APP_B",
  sourceName: "OSHA 29 CFR 1910.120 Appendix B",
  sourceDocumentTitle: "General Description and Discussion of the Levels of Protection and Protective Gear",
  sourceUrl: "https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.120AppB",
};

type Source = typeof ERG;
let counter = 0;
function fact(source: Source, fieldGroup: string, fieldName: string, value: string, sourcePage: string): HazardSourceFact & { fieldGroup: string } {
  counter += 1;
  return {
    id: `${UNKNOWN_SUBSTANCE_ID}-${counter}`,
    ...source,
    fieldGroup,
    fieldName,
    value,
    sourcePage,
    sourceLocator: sourcePage,
    verificationStatus: "Source Imported",
    notes: "Quoted verbatim from the published source.",
  };
}

const G111 = "Guide 111 (orange section)";
const FBI_SC1 = "Critical Response Issues for Scenario #1";

const overviewFacts = [
  fact(ERG, "IDENTITY", "ERG guide", "GUIDE 111 — Mixed Load/Unidentified Cargo", G111),
  fact(FBI, "IDENTITY", "Scenario 1", "Letter/container with unknown powder-like substance and threatening communication (with or without illness)", "Page 1 — General scenarios"),
  fact(FBI, "IDENTITY", "Scenario 2", "Letter/container with a threat but no visible powder or substances present", "Page 1 — General scenarios"),
  fact(FBI, "IDENTITY", "Scenario 3", "Letter/container with unknown powder, no articulated threat, and no illness", "Page 1 — General scenarios"),
  fact(FBI, "IDENTITY", "Scenario 4", "Letter/container with no visible powder, no threat, but recipients are ill", "Page 1 — General scenarios"),
  fact(FBI, "IDENTITY", "Scenario 5", "Letter/container arrives with no powder, no threat, the recipient is not ill, but the recipient is concerned about the package", "Page 1 — General scenarios"),
  fact(FBI, "HAZARDS", "All-hazards caution", "While this guidance is generally focused on the initial response to potential biological threats, all personnel responding to such incidents must be aware of the potential for exposure to hazardous chemical and/or radiological materials in addition to biological hazards. Additionally, there may be a threat posed from secondary releases or devices.", "Page 1 — Introduction"),
];

const hazardFacts = [
  fact(ERG, "HAZARDS", "Health", "Inhalation, ingestion or contact with substance may cause severe injury, infection, disease or death.", `${G111} — Potential Hazards: Health`),
  fact(ERG, "HAZARDS", "Health", "High concentration of gas may cause asphyxiation without warning.", `${G111} — Potential Hazards: Health`),
  fact(ERG, "HAZARDS", "Health", "Contact may cause burns to skin and eyes.", `${G111} — Potential Hazards: Health`),
  fact(ERG, "HAZARDS", "Health", "Fire or contact with water may produce irritating, toxic and/or corrosive gases.", `${G111} — Potential Hazards: Health`),
  fact(ERG, "HAZARDS", "Fire or explosion", "May explode from heat, shock, friction or contamination.", `${G111} — Potential Hazards: Fire or Explosion`),
  fact(ERG, "HAZARDS", "Fire or explosion", "May react violently or explosively on contact with air, water or foam.", `${G111} — Potential Hazards: Fire or Explosion`),
  fact(ERG, "HAZARDS", "Fire or explosion", "May be ignited by heat, sparks or flames.", `${G111} — Potential Hazards: Fire or Explosion`),
];

const ppeFacts = [
  fact(ERG, "PPE", "Respiratory", "Wear positive pressure self-contained breathing apparatus (SCBA).", `${G111} — Public Safety: Protective Clothing`),
  fact(ERG, "PPE", "Structural gear", "Structural firefighters' protective clothing provides thermal protection but only limited chemical protection.", `${G111} — Public Safety: Protective Clothing`),
  fact(FBI, "PPE", "Unprotected responders", "Under NO CIRCUMSTANCES should an unprotected responder, such as a law enforcement officer, attempt to package an unknown substance.", "Recommended procedures"),
  fact(OSHA, "PPE", "Level A criteria", "Substances with a high degree of hazard to the skin are known or suspected to be present, and skin contact is possible", "Appendix B — Level A protection should be used when (2)"),
  fact(OSHA, "PPE", "Level B criteria", "The type and atmospheric concentration of substances have been identified and require a high level of respiratory protection, but less skin protection", "Appendix B — Level B protection should be used when (1)"),
];

const detectionFacts = [
  fact(FBI, "DETECTION", "Field safety screening", "Perform basic field safety screening of the substance to rule out explosives, radiation, flammability, corrosives, and volatile organic compounds prior to transporting the materials to the appropriate LRN, as coordinated with the FBI WMD Coordinator. All field safety screening that is performed by responders should be clearly documented and shared with law enforcement and the LRN.", `${FBI_SC1} — Step 9`),
  fact(FBI, "DETECTION", "Biological threat suspected", "In situations where biological threat agents are suspected, the item(s) should be field safety screened and immediately transported in law enforcement custody to an LRN laboratory. This should be done in coordination with the local FBI WMD Coordinator. Field safety screening should be limited to ruling out explosive devices, radiological materials, corrosive materials and volatile organic compounds.", "Field screening"),
];

const isolationStandoffFacts = [
  fact(ERG, "ISOLATION_STANDOFF", "Immediate precautionary measure", "Isolate spill or leak area for at least 100 meters (330 feet) in all directions.", `${G111} — Public Safety: Evacuation`),
  fact(ERG, "ISOLATION_STANDOFF", "Fire", "If tank, rail tank car or highway tank is involved in a fire, ISOLATE for 800 meters (1/2 mile) in all directions; also, consider initial evacuation for 800 meters (1/2 mile) in all directions.", `${G111} — Public Safety: Evacuation`),
  fact(ERG, "ISOLATION_STANDOFF", "Public safety", "Keep unauthorized personnel away.", `${G111} — Public Safety`),
  fact(ERG, "ISOLATION_STANDOFF", "Public safety", "Stay upwind, uphill and/or upstream.", `${G111} — Public Safety`),
  fact(FBI, "ISOLATION_STANDOFF", "Do not disturb", "Do not touch, move, or open any suspicious package until an initial hazard risk assessment of the package can be performed in coordination with HAZMAT personnel and law enforcement.", `${FBI_SC1} — Step 3`),
  fact(ERG, "ISOLATION_STANDOFF", "Spill or leak", "Do not touch or walk through spilled material.", `${G111} — Emergency Response: Spill or Leak`),
];

const deconFacts = [
  fact(ERG, "DECON", "Contaminated clothing", "Remove and isolate contaminated clothing and shoes.", `${G111} — Emergency Response: First Aid`),
  fact(ERG, "DECON", "Skin contact", "For minor skin contact, avoid spreading material on unaffected skin.", `${G111} — Emergency Response: First Aid`),
  fact(ERG, "DECON", "Skin or eye contact", "In case of contact with substance, remove immediately by flushing skin or eyes with running water for at least 20 minutes.", `${G111} — Emergency Response: First Aid`),
  fact(FBI, "DECON", "HazMat team tasks", "Request the assistance of the nearest certified hazardous materials response team to conduct risk assessments, field safety screening, sample (evidence) collection, decontamination, and other mitigation activities. Any sample (evidence) collection must be coordinated with law enforcement (FBI).", `${FBI_SC1} — Step 1`),
];

const medicalFacts = [
  fact(ERG, "MEDICAL", "General first aid", "Ensure that medical personnel are aware of the material(s) involved, take precautions to protect themselves and avoid contamination.", `${G111} — Emergency Response: First Aid`),
  fact(ERG, "MEDICAL", "General first aid", "Move victim to fresh air if it can be done safely.", `${G111} — Emergency Response: First Aid`),
  fact(ERG, "MEDICAL", "Delayed effects", "Effects of exposure (inhalation, ingestion, or skin contact) to substance may be delayed.", `${G111} — Emergency Response: First Aid`),
  fact(FBI, "MEDICAL", "Exposed persons list", "In coordination with public health and law enforcement, identify and list the names and contact information for anyone who may have been exposed to the suspicious substance so that they may be contacted when the LRN test results are available or if there is other additional information.", `${FBI_SC1} — Step 11`),
  fact(FBI, "MEDICAL", "Public health", "Contact your local public health department (who should in turn notify state authorities and the CDC) if there is a threat of public health exposure or environmental contamination exists.", `${FBI_SC1} — Step 5`),
];

const technicalOperationsFacts = [
  fact(FBI, "TECHNICAL_OPERATIONS", "Notify law enforcement", "Notify appropriate law enforcement (local, state and local FBI WMD coordinator/JTTF, postal inspectors) when a potential threat is identified.", `${FBI_SC1} — Step 2`),
  fact(FBI, "TECHNICAL_OPERATIONS", "Postal Inspection Service", "In coordination with law enforcement, always notify the U.S. Postal Inspection Service, whenever it appears that the threat was delivered through the U.S. Postal Service.", `${FBI_SC1} — Step 6`),
  fact(FBI, "TECHNICAL_OPERATIONS", "Crime scene", "Treat the scene as a crime scene. Preserve evidence in coordination with law enforcement and ensure that materials are safely packaged.", `${FBI_SC1} — Step 7`),
  fact(FBI, "TECHNICAL_OPERATIONS", "Chain of custody", "Transfer custody of evidence to a law enforcement officer as soon as possible. Maintain chain of custody by obtaining a record of names and signatures every time custody of a suspicious material or sample for laboratory analysis changes hands.", `${FBI_SC1} — Step 8`),
  fact(FBI, "TECHNICAL_OPERATIONS", "Sample transport", "In coordination with the local FBI WMD Coordinator (and/or a responding law enforcement entity), transport samples to the designated CDC-qualified LRN facility.", `${FBI_SC1} — Step 10`),
  fact(FBI, "TECHNICAL_OPERATIONS", "Single point of contact", "In coordination with the FBI, identify a single point-of-contact for incident follow-up.", `${FBI_SC1} — Step 12`),
];

const allFacts = [...overviewFacts, ...hazardFacts, ...ppeFacts, ...detectionFacts, ...isolationStandoffFacts, ...deconFacts, ...medicalFacts, ...technicalOperationsFacts];

const UNKNOWN_QUERY = /unknown|powder|white|suspicious|letter|envelope|package|unidentified|mixed load|^111$|guide 111|erg 111/i;

export function matchesUnknownSubstanceQuery(query: string) {
  return UNKNOWN_QUERY.test(String(query ?? "").trim());
}

export function unknownSubstanceSearchResult(lane: HazardSearchResult["lane"] = "CBRNE_CWA"): HazardSearchResult {
  return {
    id: UNKNOWN_SUBSTANCE_ID,
    lane,
    displayName: "Unknown Substance / Suspicious Powder",
    scientificName: "Unidentified material — ERG Guide 111",
    domain: "UNKNOWN",
    category: "Unknown / White Powder",
    aliases: ["White powder", "Suspicious letter", "Suspicious package", "Unidentified cargo", "ERG 111"],
    agentCodes: [],
    cas: [],
    unNaNumbers: [],
    verificationStatus: "Source Imported",
    sourceSummary: [ERG.sourceName, FBI.sourceName, OSHA.sourceName],
  };
}

export function unknownSubstanceProfile(): HazardProfile & Record<string, unknown> {
  return {
    id: UNKNOWN_SUBSTANCE_ID,
    lane: "CBRNE_CWA",
    domain: "UNKNOWN",
    displayName: "Unknown Substance / Suspicious Powder",
    scientificName: "Unidentified material — ERG Guide 111",
    category: "UNKNOWN_SUBSTANCE",
    verificationStatus: "Source Imported",
    identifiers: {
      scientificName: "Unidentified material",
      aliases: ["White powder", "Suspicious letter", "Suspicious package", "Unidentified cargo"],
      agentCodes: [],
      cas: [],
      unNaNumbers: [],
      ergGuide: "111",
      ergInitialIsolationM: 100,
      ergProtectiveActionDistances: "Isolate spill or leak area for at least 100 meters (330 feet) in all directions (ERG 2024 Guide 111).",
      radionuclideSymbol: null,
      isotopeMassNumber: null,
      opcwSchedule: null,
    },
    overviewFacts,
    hazardFacts,
    detectionFacts,
    ppeFacts,
    isolationStandoffFacts,
    deconFacts,
    medicalFacts,
    technicalOperationsFacts,
    sourceFacts: allFacts,
    primaryThreat: {
      classLabel: "UNKNOWN SUBSTANCE",
      statement: "Inhalation, ingestion or contact with substance may cause severe injury, infection, disease or death.",
      basis: "ERG_GUIDE",
      sourceName: ERG.sourceName,
      sourceUrl: ERG.sourceUrl,
      verificationStatus: "Source Imported",
    },
    actionCards: [
      { title: "Isolate", status: "Source Imported", summary: "Isolate spill or leak area for at least 100 meters (330 feet) in all directions." },
      { title: "Do not disturb", status: "Source Imported", summary: "Do not touch, move, or open any suspicious package until an initial hazard risk assessment of the package can be performed in coordination with HAZMAT personnel and law enforcement." },
      { title: "Notify", status: "Source Imported", summary: "Notify appropriate law enforcement (local, state and local FBI WMD coordinator/JTTF, postal inspectors) when a potential threat is identified." },
      { title: "Field safety screening", status: "Source Imported", summary: "Perform basic field safety screening of the substance to rule out explosives, radiation, flammability, corrosives, and volatile organic compounds prior to transporting the materials to the appropriate LRN." },
      { title: "Evidence / chain of custody", status: "Source Imported", summary: "Treat the scene as a crime scene. Maintain chain of custody by obtaining a record of names and signatures every time custody of a suspicious material or sample for laboratory analysis changes hands." },
      { title: "Exposed persons", status: "Source Imported", summary: "Identify and list the names and contact information for anyone who may have been exposed to the suspicious substance." },
    ],
    limitations: [
      "This profile does not select a PPE level. OSHA 1910.120 Appendix B criteria are shown; the Safety Officer / Incident Commander selects the level per agency SOP.",
      "Neither source specifies a mass-decontamination procedure for exposed persons; follow agency SOP and public-health direction.",
      "Once field screening or laboratory results identify the material, switch to that material's profile.",
    ],
    dataStatusBadges: ["Source Imported"],
    sourceStatus: {
      sourcePacksLoaded: 3,
      sourceFactCount: allFacts.length,
      sourceNames: [ERG.sourceName, FBI.sourceName, OSHA.sourceName],
      requiresSmeReviewCount: 0,
      conflictingSourcesCount: 0,
      missingFieldCount: 0,
      lastImportUpdate: "2026-11-19T00:00:00.000Z",
      warnings: [],
    },
  };
}
