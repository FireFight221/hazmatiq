import type {
  CbrneMasterRecord,
  CbrneSourceFact,
  RadiologicalProfile,
  RadiologicalProfileField,
  RadiologicalReference,
  RadiologicalResponseStage,
  RadiologicalScenarioGuidance,
} from "./cbrneTypes.js";
import type { RadionuclidePhysicsRecord } from "../../data/cbrne/authoritative/radionuclidePhysics.js";

const REVIEW_DATE = "2026-10-15";
const NOT_AVAILABLE = "Not available from the reviewed source set.";

const EPA_CESIUM: RadiologicalReference = {
  name: "EPA",
  document: "Radionuclide Basics: Cesium-137",
  url: "https://www.epa.gov/radiation/radionuclide-basics-cesium-137",
};
const NNDC: RadiologicalReference = {
  name: "Brookhaven National Laboratory NNDC",
  document: "NuDat 3 — evaluated nuclear structure and decay data",
  url: "https://www.nndc.bnl.gov/nudat3/",
};
const NNDC_DECAY: RadiologicalReference = {
  ...NNDC,
  document: "ENSDF 137CS decay dataset",
  url: "https://www.nndc.bnl.gov/nudat3/getdecaydataset.jsp?dsid=137cs+bM+decay&nucleus=137BA",
  locator: "137CS decay dataset; Ba-137m transition",
};
const REMM_PPE: RadiologicalReference = {
  name: "HHS ASPR REMM",
  document: "Personal Protective Equipment (PPE) in a Radiation Emergency",
  url: "https://remm.hhs.gov/radiation_ppe.htm",
};
const REMM_SURVEY: RadiologicalReference = {
  name: "HHS ASPR REMM",
  document: "How to Perform a Survey for Radiation Contamination",
  url: "https://www.remm.hhs.gov/howtosurvey.htm",
};
const REMM_DECON: RadiologicalReference = {
  name: "HHS ASPR REMM",
  document: "Procedures for Radiation Decontamination",
  url: "https://remm.hhs.gov/ext_contamination.htm",
};
const CDC_CONTAMINATION: RadiologicalReference = {
  name: "CDC",
  document: "What Causes Contamination versus Exposure",
  url: "https://www.cdc.gov/radiation-emergencies/causes/",
};
const CDC_TREATMENT: RadiologicalReference = {
  name: "CDC",
  document: "Treatment of Radiation Exposure and Contamination",
  url: "https://www.cdc.gov/radiation-emergencies/treatment/",
};
const EPA_PAG: RadiologicalReference = {
  name: "EPA",
  document: "Protective Action Guides (PAGs)",
  url: "https://www.epa.gov/radiation/protective-action-guides-pags",
};
const IAEA_FIRST_RESPONDER: RadiologicalReference = {
  name: "IAEA",
  document: "Manual for First Responders to a Radiological Emergency",
  url: "https://www-pub.iaea.org/MTCD/Publications/PDF/EPR_FirstResponder_web.pdf",
};
const REMM_NUCLEAR: RadiologicalReference = {
  name: "HHS ASPR REMM",
  document: "Nuclear Detonation Response Key Guidance",
  url: "https://remm.hhs.gov/nuclearresponse_docs.htm",
};
const REMM_FALLOUT: RadiologicalReference = {
  name: "HHS ASPR REMM",
  document: "Fallout from a Nuclear Detonation: Description and Management",
  url: "https://remm.hhs.gov/nuclearfallout.htm",
};
const NRC_CRITICALITY: RadiologicalReference = {
  name: "U.S. Nuclear Regulatory Commission",
  document: "Criticality accident requirements",
  url: "https://www.nrc.gov/reading-rm/doc-collections/cfr/part076/part076-0089.html",
};

function factByGroup(facts: readonly CbrneSourceFact[], groups: readonly string[]) {
  return facts.find((fact) => groups.includes(fact.fieldGroup) && fact.value !== null) ?? null;
}

function factField(fact: CbrneSourceFact | null, fallback = NOT_AVAILABLE): RadiologicalProfileField {
  return {
    label: fact?.fieldName || "Data status",
    value: fact?.value === null || fact?.value === undefined || fact.value === "" ? fallback : String(fact.value),
    status: fact?.verificationStatus || "Not available",
    source: fact ? {
      name: fact.sourceName,
      document: fact.sourceDocumentTitle || fact.sourceName,
      url: fact.sourceUrl || "",
      locator: fact.sourceLocator || fact.sourcePage,
    } : undefined,
    note: fact?.notes,
  };
}

function unavailable(label: string, note = "The incident-specific value is not inferred from isotope identity."): RadiologicalProfileField {
  return { label, value: NOT_AVAILABLE, status: "Not available", note };
}

function uniqueReferences(references: readonly RadiologicalReference[]) {
  return [...new Map(references.filter((reference) => reference.url).map((reference) => [reference.url, reference])).values()];
}

function responseStage(priority: number, title: string, actions: string[], sources: RadiologicalReference[]): RadiologicalResponseStage {
  return { priority, title, actions, sources: uniqueReferences(sources) };
}

function scenario(title: string, applicability: string, guidance: string, hazards: string[], sources: RadiologicalReference[]): RadiologicalScenarioGuidance {
  return { title, applicability, guidance, hazards, sources: uniqueReferences(sources) };
}

function cesiumEmissions(physics: RadionuclidePhysicsRecord | null): RadiologicalProfileField[] {
  if (!physics) return [unavailable("Radiation emissions")];
  return [
    {
      label: "Beta",
      value: "Beta-minus decay: Cs-137 decays to Ba-137m and, in a smaller branch, to stable Ba-137. The evaluated parent decay record reports B− decay; branch details remain source-data dependent.",
      status: "Source Imported",
      source: NNDC_DECAY,
      note: "Do not turn decay energy into a field dose estimate without activity, geometry, and measurement data.",
    },
    {
      label: "Gamma",
      value: "Ba-137m releases associated gamma radiation as it transitions to stable Ba-137; the characteristic gamma energy is approximately 661.7 keV.",
      status: "Source Imported",
      source: NNDC_DECAY,
      note: "Gamma penetration depends on source activity, geometry, distance, and shielding; no dose rate is assumed.",
    },
    unavailable("Alpha", "No alpha emission is identified in the reviewed Cs-137 decay record."),
    unavailable("Neutron", "Neutron emission is not identified in the reviewed Cs-137 decay record."),
  ];
}

export function buildRadiologicalProfile(
  record: CbrneMasterRecord,
  facts: readonly CbrneSourceFact[],
  physics: RadionuclidePhysicsRecord | null,
): RadiologicalProfile {
  const identityFact = factByGroup(facts, ["IDENTITY"]);
  const detectionFact = factByGroup(facts, ["DETECTION", "RADIOLOGICAL_SURVEY"]);
  const ppeFact = factByGroup(facts, ["PPE"]);
  const isotope = record.id === "cesium-137";
  const aliases = [...new Set([
    ...record.commonNames,
    ...record.aliases,
    record.radionuclideSymbol,
    record.id === "cesium-137" ? "caesium-137" : undefined,
    record.id === "cesium-137" ? "Cs137" : undefined,
  ].filter(Boolean))];
  const references = uniqueReferences([
    ...(isotope ? [EPA_CESIUM, NNDC, NNDC_DECAY] : []),
    REMM_PPE, REMM_SURVEY, REMM_DECON, CDC_CONTAMINATION, CDC_TREATMENT, EPA_PAG,
    IAEA_FIRST_RESPONDER, REMM_NUCLEAR, REMM_FALLOUT, NRC_CRITICALITY,
    ...facts.flatMap((fact) => fact.sourceUrl ? [{
      name: fact.sourceName,
      document: fact.sourceDocumentTitle || fact.sourceName,
      url: fact.sourceUrl,
      locator: fact.sourceLocator || fact.sourcePage,
    } as RadiologicalReference] : []),
  ]);

  return {
    schemaVersion: "radiological-profile-v1",
    contentReviewDate: REVIEW_DATE,
    identity: [
      { label: "Isotope name", value: record.displayName, status: "Source Imported", source: identityFact ? factField(identityFact).source : (isotope ? EPA_CESIUM : NNDC) },
      { label: "Symbol", value: record.radionuclideSymbol || NOT_AVAILABLE, status: record.radionuclideSymbol ? "Source Imported" : "Not available", source: isotope ? EPA_CESIUM : NNDC },
      { label: "Aliases", value: aliases.length ? aliases.join(" · ") : NOT_AVAILABLE, status: aliases.length ? "Source Imported" : "Not available", source: identityFact ? factField(identityFact).source : undefined },
      { label: "Half-life", value: physics?.halfLifeOriginal || NOT_AVAILABLE, status: physics?.halfLifeOriginal ? "Source Imported" : "Not available", source: physics?.halfLifeOriginal ? NNDC : undefined, note: "Evaluated nuclear-data value; this is not a dose or safe-stay-time value." },
    ],
    emissions: isotope ? cesiumEmissions(physics) : [unavailable("Radiation emissions", "Emission details are not available in the reviewed isotope record.")],
    exposureAndContamination: isotope ? [
      { label: "External exposure", value: "External exposure is possible from penetrating gamma radiation associated with Cs-137 decay. Exact dose depends on source activity, geometry, time, distance, shielding, and measurements; none is assumed here.", status: "Source Imported", source: EPA_CESIUM },
      { label: "External contamination", value: "If radioactive material escapes containment, it can contaminate skin, hair, clothing, surfaces, or equipment. Exposure and contamination are different conditions.", status: "Requires SME Review", source: CDC_CONTAMINATION },
      { label: "Internal contamination", value: "If material is dispersed, inhalation, ingestion, or entry through open wounds can create internal contamination. Intake, chemical form, and dose are not available for this selection.", status: "Requires SME Review", source: EPA_CESIUM },
    ] : [
      unavailable("External exposure"),
      unavailable("External contamination"),
      unavailable("Internal contamination"),
    ],
    sourceFormAndContainment: [
      unavailable("Source form", "The selected record identifies an isotope, not the physical source form or activity."),
      unavailable("Containment condition", "Do not assume sealed, damaged, dispersed, or unknown containment; determine it from scene assessment and radiation-authority information."),
      { label: "Intact sealed-source distinction", value: "An intact sealed source primarily presents an external exposure question; contamination becomes a concern if the source or its capsule is damaged, breached, or dispersed. The selected incident condition is unknown.", status: "Requires SME Review", source: IAEA_FIRST_RESPONDER },
    ],
    timeDistanceShielding: [
      { label: "Time", value: "Limit time near a suspected source and keep missions risk-based; do not use a universal stay time.", status: "Requires SME Review", source: IAEA_FIRST_RESPONDER },
      { label: "Distance", value: "Increase distance from a suspected source and use measured conditions to establish controlled areas; no universal safe distance is provided.", status: "Requires SME Review", source: IAEA_FIRST_RESPONDER },
      { label: "Shielding", value: "Use appropriate shielding selected for the radiation, geometry, and mission. Protective clothing controls contamination but does not shield penetrating gamma radiation.", status: "Requires SME Review", source: REMM_PPE },
    ],
    detectionAndSurvey: [
      factField(detectionFact, "No isotope-specific survey fact is available; use a radiation-qualified survey plan."),
      { label: "Survey practice", value: "Perform instrument operational and background checks, survey systematically, maintain consistent geometry, and document instrument, locations, readings, and time.", status: "Requires SME Review", source: REMM_SURVEY },
      { label: "Instrument limitations", value: "Detector response, energy dependence, efficiency, dead time, geometry, background, and contamination-versus-dose-rate capability vary by instrument. Confirm the instrument’s intended use and calibration; no capability is assumed.", status: "Requires SME Review", source: REMM_SURVEY },
    ],
    ppeAndRespiratory: [
      factField(ppeFact, "PPE and dosimetry guidance is not available from the selected isotope record."),
      { label: "Respiratory protection", value: "Consider respiratory protection only when airborne radioactive material is a credible hazard and select it through the incident hazard assessment, program, and radiation/industrial-hygiene authority. It does not shield penetrating gamma radiation.", status: "Requires SME Review", source: REMM_PPE },
      { label: "Contamination control", value: "Use contamination-control practices and personal radiation dosimetry as directed by incident command and the radiation safety/health-physics authority.", status: "Requires SME Review", source: REMM_PPE },
    ],
    responseStages: [
      responseStage(1, "Initial recognition and scene assessment", [
        "Treat an unidentified radiation warning, source, package, or contaminated scene as a radiation concern until qualified assessment is available.",
        "Establish command, keep people away from the suspected source, preserve scene safety, and do not infer activity, dose rate, source form, or containment from the isotope name alone.",
      ], [IAEA_FIRST_RESPONDER, REMM_NUCLEAR]),
      responseStage(2, "Responder protection and exposure management", [
        "Minimize time, maximize distance, and use appropriate shielding selected for the measured or assessed radiation field.",
        "Use assigned dosimetry and hazard-appropriate PPE; remember that protective clothing is contamination control, not gamma shielding.",
      ], [IAEA_FIRST_RESPONDER, REMM_PPE]),
      responseStage(3, "Monitoring and zone establishment", [
        "Use an appropriate, checked instrument; survey systematically and document instrument, background, geometry, readings, and time.",
        "Establish and revise controlled areas from measurements, projected dose, incident conditions, and authority guidance—not a universal distance or dose limit.",
      ], [REMM_SURVEY, EPA_PAG]),
      responseStage(4, "Contamination control and patient care", [
        "Separate external exposure from contamination. Do not delay airway, breathing, circulation, trauma care, or other lifesaving treatment solely for decontamination.",
        "When clinically appropriate, remove and bag outer clothing, survey, and use gentle soap and water while preventing spread; obtain medical and health-physics support for suspected internal contamination.",
      ], [CDC_CONTAMINATION, CDC_TREATMENT, REMM_DECON]),
      responseStage(5, "Specialist coordination and incident stabilization", [
        "Coordinate with the radiation safety officer/health physicist, public health, emergency management, medical specialists, and law enforcement when the scenario warrants.",
        "Use current EPA PAG and incident-specific authority guidance; update zones, protective actions, and communications as better measurements and source information become available.",
      ], [EPA_PAG, IAEA_FIRST_RESPONDER, REMM_NUCLEAR]),
    ],
    scenarioGuidance: [
      scenario("Reactor or facility release", "Use only when a facility release or plume/ground-deposition scenario is suspected.", "Use facility and release-specific source terms, measurements, projected dose, and EPA PAG decision support. Contamination, airborne release, and deposited material may be relevant; blast and thermal hazards are not assumed from this category.", ["Radiation exposure", "Airborne or deposited contamination", "Potential environmental contamination"], [EPA_PAG]),
      scenario("Nuclear detonation and fallout", "Use only when an actual or suspected nuclear detonation is indicated.", "Treat this as a multi-hazard event: blast, thermal injury, prompt radiation, fallout, fire, structural damage, and contamination may coexist. Use nuclear-detonation guidance and prioritize lifesaving care and protective sheltering decisions; do not treat it as an ordinary sealed-source incident.", ["Blast", "Thermal", "Prompt radiation", "Fallout/external exposure", "Contamination", "Fire/structural hazards"], [REMM_NUCLEAR, REMM_FALLOUT]),
      scenario("Suspected criticality event", "Use only when an uncontrolled chain reaction or criticality accident is suspected.", "Withdraw and deny entry, avoid re-entry, account for prompt neutron and gamma exposure potential, and request qualified criticality/radiation specialists. Do not apply Cs-137 source assumptions or a fixed stay time.", ["Prompt neutron", "Prompt gamma", "Potential acute exposure", "Process/industrial hazards"], [IAEA_FIRST_RESPONDER, NRC_CRITICALITY]),
      scenario("RDD / dirty-bomb dispersal", "Use when radioactive material may have been dispersed by an explosive or other dispersal mechanism.", "Keep RDD response distinct from a nuclear detonation: assess blast/trauma and crime-scene hazards alongside contamination and radiation, coordinate law enforcement and radiation authorities, and use measured conditions for control areas.", ["Blast/trauma", "Contamination", "External radiation", "Crime-scene/security hazards"], [EPA_PAG, REMM_NUCLEAR, IAEA_FIRST_RESPONDER]),
      scenario("Suspected exposure device or point source", "Use when a device or source may expose people without evidence of broad dispersal.", "Control access, increase distance, avoid handling, and request radiation safety/health-physics and law-enforcement support. Contamination is not assumed unless material release or damaged containment is established.", ["External exposure", "Device/security hazards", "Possible contamination if breached"], [IAEA_FIRST_RESPONDER, REMM_PPE]),
    ],
    references,
  };
}
