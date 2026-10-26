import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const builder = readFileSync(new URL("../server/public/guided-response-decision-builder.js", import.meta.url), "utf8");
const ppeEngine = readFileSync(new URL("../src/lib/ppe/ppeRecommendationEngine.ts", import.meta.url), "utf8");
const styles = [
  readFileSync(new URL("../server/public/styles.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/guided-response-overrides.css", import.meta.url), "utf8"),
  readFileSync(new URL("../server/public/dashboard-header.css", import.meta.url), "utf8"),
].join("\n");
const guidedHtml = html.slice(
  html.indexOf('<section id="guided-response"'),
  html.indexOf('<section id="my-chemicals"'),
);
const lookupHtml = html.slice(
  html.indexOf('<section id="lookup"'),
  html.indexOf('<section id="chem-compare"'),
);

describe("Guided Response workflow", () => {
  it("uses the branded unified Hazard ID hero with one tabbed search console", () => {
    expect(styles).toContain('url("assets/hazard-id-level-b-hero-v2.png")');
    expect(lookupHtml.match(/data-hazard-search-tab=/g)).toHaveLength(3);
    expect(lookupHtml).toContain('id="chemical-search" type="search"');
    expect(lookupHtml).toContain('id="chemical-search"');
    expect(lookupHtml).toContain('id="chemical-lookup-btn"');
    expect(lookupHtml).not.toContain('id="cbrne-cwa-search"');
    expect(lookupHtml).not.toContain('id="radiological-search"');
    expect(lookupHtml).toContain('<h1 class="hazmat-hero-title">HAZARD ID</h1>');
    expect(styles).toContain("/* Hazard ID command console — cinematic single-search workspace. */");
    expect(styles).toMatch(/#lookup > \.hazard-id-command-console\.chemical-id-search-card[^}]*grid-column: 1 !important;/s);
    expect(styles).toMatch(/#lookup > #chemical-id-results[^}]*grid-column: 1 !important;/s);
  });

  it("does not render a Sources bubble in the populated Chemical Profile header", () => {
    const metaItems = script.slice(
      script.indexOf("const metaItems = ["),
      script.indexOf("metaItems.forEach"),
    );
    expect(metaItems).not.toContain("['Sources'");
  });

  it("consolidates Properties into Chemical Properties and Reactivity", () => {
    const properties = script.slice(
      script.indexOf("{ key: 'properties'"),
      script.indexOf("{ key: 'exposures'"),
    );
    expect(properties).toContain("createProfileSection('Chemical Properties'");
    expect(properties).toContain("createProfileSection('Reactivity'");
    expect(properties).not.toContain("createProfileSection('Flammability & Energy'");
    expect(properties).not.toContain("createProfileSection('Synonyms & Notes'");
    expect(styles).toContain('data-active-tab="properties"]');
    expect(styles).toContain('[data-section="chemical-properties"]');
    expect(styles).toContain('[data-section="reactivity"]');
  });

  it("uses bright white, enlarged Chemical Profile titles and field labels", () => {
    expect(styles).toMatch(/chemical-profile-section h4[^}]*color: #fff;[^}]*font-size: 1\.05rem;[^}]*font-weight: 850;/s);
    expect(styles).toMatch(/chemical-profile-row > span[^}]*chemical-profile-list-row strong[^}]*color: #fff;[^}]*font-size: 0\.88rem;[^}]*font-weight: 850;/s);
    expect(styles).toMatch(/chemical-profile-meta-title[^}]*color: #fff;[^}]*font-size: 0\.7rem;[^}]*font-weight: 800;/s);
  });

  it("centers and emphasizes the Chemical Profile transport metadata", () => {
    expect(script).toContain("['Hazard Class', formatHazardClassLines(profile?.header?.hazardClass || profile?.header?.hazard).join('\\n') || noCurrentDataText]");
    expect(script).not.toContain("['Packing Group', profile?.header?.packingGroup");
    expect(styles).toContain('.chemical-profile-meta-item');
    expect(styles).toContain('[data-field="un-na"]');
    expect(styles).toContain('[data-field="erg-guide"]');
  });

  it("provides green Guided Response and print/download profile actions", () => {
    expect(styles).toContain('#guided-response #guided-open-plume-btn');
    for (const id of ['guided-open-plume-btn', 'guided-save-record-btn', 'guided-save-incident-btn']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(script).toContain('function saveGuidedResponseTacticalRecord');
  });

  it("removes the Chemical ID subtitle and places compact Reactivity beside Fire Behavior", () => {
    expect(lookupHtml).not.toContain('Powered by Chemical Companion');
    expect(styles).toContain('data-section="fire-behavior"');
    expect(styles).toContain('data-section="reactivity-profile"');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.15fr) minmax(270px, 0.85fr);');
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it("keeps Guided Response in the command workflow and Plume Model in the profile toolbar", () => {
    expect(html).toContain('data-command-view="guided-response"');
    expect(html).toContain('id="open-plume-btn"');
    expect(html).toContain('id="open-guided-response-btn"');
    expect(html).toContain('>GUIDED RESPONSE</button>');
    expect(styles).toContain('#guided-response #guided-open-plume-btn');
    expect(styles).toContain('#chemical-id-results #open-guided-response-btn');
  });

  it("opens Guided Response from both Chemical Profile and Plume Model", () => {
    expect(html).toContain('data-command-view="guided-response"');
    expect(html).toContain('id="guided-open-plume-btn" type="button">Open Plume Model</button>');
    expect(script).toContain("function openGuidedResponseWorkspace()");
    expect(script).toContain("target === 'guided-response'");
    expect(script).toContain("document.getElementById('guided-open-plume-btn')?.addEventListener('click', openPlumeWorkspace)");
    expect(styles).toContain('#guided-response #guided-open-plume-btn');
  });

  it("provides the new view, required actions, and compact disclaimers", () => {
    expect(html).toContain('id="guided-response" class="view guided-response-page"');
    expect(guidedHtml).toContain('class="hazmat-page-hero hazmat-page-hero-compact emergenz-page-header variant-guided-response guided-response-page-header"');
    expect(guidedHtml).toContain('class="emergenz-page-header-icon"');
    expect(guidedHtml).toContain('<h1 class="hazmat-hero-title">Guided Response</h1>');
    expect(guidedHtml).toContain('Command Actions');
    for (const id of [
      "guided-open-plume-btn",
      "guided-save-record-btn",
      "guided-save-incident-btn",
      "guided-save-chemical-btn",
      "guided-back-btn",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Missing, outdated, unsupported, or unverified values must be treated as No Current Data Exists.");
    expect(script).toContain("createGuidedCommandFlow(guidedResponse, {");
    expect(script).toContain("createGuidedSourceTrace(stage.sources)");
    expect(script).toContain("const strategyControl = createGuidedOperationalStrategyControl(activeIncident, selectedOperationalStrategy);");
    expect(script).toContain("const operationalStrategyOptions = Object.freeze(['Offensive', 'Defensive', 'Non-Intervention']);");
    expect(script).toContain("strategyPhaseDefinition(phase, context.strategy, context)");
    expect(script).toContain("Confirm the hazard, protect the public, and define the defensive perimeter.");
    expect(script).toContain("persistOperationalModeChange(select.value)");
    expect(script).toContain("createGuidedPhaseList(guidedObjectiveEntries(phase), noCurrentDataText, true)");
    expect(script).toContain("const guidedObjectiveIds = Object.freeze({");
    expect(script).toContain("function createGuidedReferenceSection(phase, sources, { profile, strategy, gapKeys = new Set() } = {})");
    expect(script).toContain("heading.textContent = 'References & Sources'");
    expect(script).not.toContain("rolesHeading.textContent = 'ROLES & RESPONSIBILITIES'");
    expect(styles).toContain('#guided-response .guided-operational-strategy { display: grid; gap: 8px; height: auto; min-height: 0;');
    expect(styles).toContain('#guided-response .guided-operational-strategy-top { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);');
    expect(guidedHtml).toContain('class="guided-response-disclaimers"');
  });

  it("reuses selected state and blocks missing or unresolved chemical identity", () => {
    expect(script).toContain("function renderGuidedResponse()");
    expect(script).toContain("No chemical selected. Return to HAZARD ID and select a Chemical Companion master record.");
    expect(script).toContain("Chemical-specific response guidance requires a verified Chemical Companion master link.");
    expect(script).toContain("document.getElementById('guided-open-plume-btn')?.addEventListener('click', openPlumeWorkspace)");
  });

  it("uses a wrapping responsive card layout", () => {
    expect(styles).toContain(".guided-response-content");
    expect(styles).toContain('url("assets/guided-response-hero.png")');
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("@media (max-width: 900px)");
  });

  it("uses the shared compact header and explicit phase icons", () => {
    expect(styles).toContain('#guided-response > .emergenz-page-header.emergenz-page-header.emergenz-page-header');
    expect(styles).not.toContain('.guided-response-heading');
    for (const title of [
      'Identify, Isolate, and Notify',
      'Establish Zones and Prepare Resources',
      'Reconnaissance and Assessment',
      'Select and Execute a Strategy',
      'Withdraw, Decontaminate, and Provide Medical/Rehab',
      'Verify Control and Arrange Recovery/Transfer',
      'Complete Notifications and Documentation',
    ]) expect(script).toContain(`title: '${title}'`);
    expect(script).toContain('function createGuidedPhaseIcon(phase)');
    expect(script).toContain('guidedPhaseIconPaths');
    for (const iconId of [
      'identify-isolate-notify',
      'zones-resources',
      'recon-assessment',
      'mitigation-strategy',
      'withdraw-decon-rehab',
      'verify-recovery',
      'notifications-documentation',
    ]) expect(script).toContain(`'${iconId}': [`);
  });

  it("keeps Operational Guidance left and Command Actions in one vertical side column", () => {
    expect(guidedHtml).toContain('class="guided-response-workspace"');
    expect(guidedHtml).toMatch(/class="guided-response-workspace"[\s\S]*id="guided-response-content"[\s\S]*class="panel-card guided-command-actions"/);
    expect(guidedHtml.match(/class="panel-card guided-command-actions"/g)).toHaveLength(1);
    expect(styles).toContain('.guided-response-workspace {');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) minmax(220px, 270px);');
    expect(styles).toContain('.guided-command-actions .guided-response-actions {');
    expect(styles).toContain('flex-direction: column;');
  });

  it("uses the requested command action labels and contrast palette", () => {
    expect(guidedHtml).toContain('id="guided-back-btn" type="button">Open Command Dashboard</button>');
    expect(guidedHtml).toContain('id="guided-open-hazard-btn" type="button">Hazard ID</button>');
    expect(guidedHtml.indexOf('id="guided-back-btn"')).toBeLessThan(guidedHtml.indexOf('id="guided-open-hazard-btn"'));
    expect(guidedHtml.indexOf('id="guided-open-hazard-btn"')).toBeLessThan(guidedHtml.indexOf('id="guided-open-plume-btn"'));
    expect(guidedHtml.indexOf('id="guided-open-plume-btn"')).toBeLessThan(guidedHtml.indexOf('id="guided-save-incident-btn"'));
    expect(styles).toContain('#guided-response .guided-phase-card > .guided-phase-summary { background: #e7f5e9; color: #173b2a; }');
    expect(styles).toContain('#guided-response .guided-phase-icon svg { width: 28px; height: 32px; fill: none; stroke: currentColor; stroke-width: 3.2;');
    expect(script).not.toContain("guided-phase-progress");
    expect(styles).not.toContain(".guided-phase-progress");
    expect(styles).toContain('.guided-command-actions .guided-response-actions #guided-back-btn');
    expect(styles).toContain('background: #f6c343;');
    expect(styles).toContain('.guided-command-actions .guided-response-actions #guided-open-hazard-btn');
    expect(styles).toContain('.guided-command-actions .guided-response-actions #guided-save-incident-btn');
  });

  it("does not render the redundant Source / Technical Detail box", () => {
    expect(script).not.toContain("createGuidedSupportingSection('SOURCE / TECHNICAL DETAIL'");
    expect(script).toContain("flow.append(heading, notice, grid);");
    expect(script).toContain("gapKeys: referenceContext.gapKeys || (referenceContext.gapKeys = new Set())");
  });

  it("keeps goal status, commander notes, and actionable next tasks explicit", () => {
    expect(script).toContain("const guidedGoalStatusOptions = Object.freeze(['Not Started', 'In Progress', 'Accomplished', 'Needs Reassessment'])");
    expect(script).toContain("goalStatusHeading.textContent = 'Goal Status'");
    expect(script).toContain("nextDecisionHeading.textContent = 'Next Decision / Task'");
    expect(script).toContain("notesHeading.textContent = 'COMMANDER NOTES / OBSERVATIONS'");
    expect(script).toContain('Commander note saved');
    expect(styles).toContain('.guided-phase-decision-grid');
  });

  it("requires explicit assignment activation and keeps assignment history/location semantics", () => {
    expect(script).toContain("saveButton.textContent = 'Update Assignment';");
    expect(script).toContain("Enter Personnel / team, Unit / resource, and Responsibility before saving the assignment.");
    expect(script).toContain("function renderIncidentAssignmentEditor(incident)");
    expect(html).toContain('id="ic-manage-assignments-btn"');
    expect(script).toContain("locationStatus: assignment.locationStatus || 'Location not set'");
    expect(script).toContain("type: 'guided-response-assignment'");
    expect(script).toContain('guidedResponseAssignmentHistory');
    expect(script).toContain('function beginIncidentResourcePlacement(assignment)');
    expect(script).toContain('No location is assumed.');
    expect(script).toContain('Place on Map');
  });

  it("puts the command checkpoints first and makes them interactive", () => {
    expect(script).toContain("const checkpointsSection = createGuidedSupportingSection('COMMAND CHECKPOINTS'");
    expect(script).toContain("checkpointsSection.classList.add('guided-command-checkpoints')");
    expect(script).toContain("{ interactive: true, hideSource: true }");
    expect(script).toContain("if (!hideSource) row.append(createGuidedSourceBadge(source));");
    expect(script).toContain("marker.setAttribute('role', 'checkbox')");
    expect(script).toContain("guidedCommandCheckpointsStorageKey");
    expect(script).toContain("flow.append(heading, notice, checkpointsSection, grid, supportGrid)");
    expect(styles).toContain(".guided-command-checkpoints");
    expect(styles).toContain(".guided-command-checkpoint-list");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(styles).toContain("width: 28px");
    expect(styles).toContain("font-size: .9rem");
    expect(styles).toContain("grid-template-columns: 1fr;");
  });

  it("keeps the Guided Response title box compact", () => {
    expect(styles).toContain("height: 112px !important");
    expect(styles).toContain("padding: 12px 20px 12px 22px !important");
    expect(styles).toContain("gap: 13px !important");
  });

  it("makes the upper-left HazMatIQ identity prominent and symmetrical", () => {
    expect(guidedHtml).toContain('class="emergenz-page-header-copy"');
    expect(styles).toContain("flex: 0 0 74px !important");
    expect(styles).toContain("font-size: clamp(1.7rem, 2.85vw, 2.95rem) !important");
  });

  it("uses page-scoped navy hero text and menu controls over the light smoke image", () => {
    expect(styles).toMatch(/#guided-response > \.emergenz-page-header\.emergenz-page-header[\s\S]*background-image: linear-gradient/);
    expect(styles).toContain('color: #eef7ff !important;');
    expect(styles).toContain('color: #cce9fc !important;');
  });

  it("resolves the active incident chemical before rendering Guided Response", () => {
    expect(script).toContain("async function ensureGuidedResponseChemicalSelection(requestId)");
    expect(script).toContain("const targetId = activeIncident?.selectedChemicalId");
    expect(script).toContain("await ensureGuidedResponseChemicalSelection(requestId)");
    expect(script).toContain("else if (target === 'guided-response') void openGuidedResponseWorkspace();");
  });

  it("renders the ten-stage command flow with source-backed branches", () => {
    expect(script).toContain("COMMAND FLOW");
    for (const title of ["IDENTIFY / ANALYZE", "ISOLATE / ESTABLISH ZONES", "LIFE SAFETY / PPE", "MONITOR / VERIFY", "TACTICAL MODE", "CONTROL / MITIGATION", "DECONTAMINATION", "MEDICAL", "PROTECTIVE ACTIONS", "TERMINATION / DOCUMENTATION"]) {
      expect(builder).toContain(`title: '${title}'`);
    }
    expect(script).toContain("createGuidedCommandCard(stage)");
    expect(script).toContain("createGuidedBranches(stage.branches)");
    for (const removed of ["Decision First", "Verify All Data", "Team Safety"]) {
      expect(guidedHtml).not.toContain(removed);
      expect(script).not.toContain(removed);
    }
  });

  it("uses readable, restrained typography throughout the tactical decision flow", () => {
    expect(styles).toContain('.guided-command-card-summary');
    expect(styles).toContain('.guided-command-action');
    expect(styles).toContain('.guided-command-checklist');
    expect(styles).toContain('.guided-source-disclosure');
  });

  it("does not place a selected-chemical box inside the title box", () => {
    expect(script).not.toContain("createGuidedResponseCard('Selected Chemical'");
    expect(script).not.toContain("guided-header-summary");
    expect(styles).not.toContain(".guided-header-summary");
  });

  it("places the critical action bar before the responsive command-flow grid", () => {
    expect(script).toContain("const criticalActionBar = createGuidedCriticalActionBar(guidedResponse)");
    expect(script).toContain("const flow = createGuidedCommandFlow(guidedResponse, {");
    expect(script).toContain("container.append(chemicalStrip, criticalActionBar, strategyControl, mobileSticky, flow)");
    expect(script).toContain("flow.className = 'panel-card guided-command-flow'");
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it("keeps objective numbers semantic, stable, and aligned outside wrapped text", () => {
    expect(script).toContain("item.dataset.objectiveId = id");
    expect(script).toContain("id: `${phase.id}-objective-${ids[index] || index + 1}`");
    expect(styles).toContain('list-style-position: outside;');
    expect(styles).toContain('font-size: 1.18em; font-weight: 950;');
    expect(styles).toContain('padding-inline-start: 2.45rem;');
  });

  it("renders source records directly with objective coverage and explicit gaps", () => {
    expect(script).toContain("guidedReferenceSourceLink(sourceName, profile)");
    expect(script).toContain("Open direct supporting source");
    expect(script).toContain("Supports objective IDs");
    expect(script).toContain("Source gap:");
    expect(styles).toContain('.guided-reference-list { display: grid; gap: 8px; }');
    expect(styles).toContain('#guided-response.guided-response-page .guided-phase-grid .guided-phase-body .guided-reference-card');
    expect(styles).toContain('background: #fff !important; color: #1d3b4e !important;');
    expect(styles).toContain('.guided-reference-link { display: inline-block;');
  });

  it("keeps source traceability expandable and gives mobile responders a sticky context header", () => {
    expect(script).toContain("SOURCE · ${source.label || 'Needs Verification'}");
    expect(script).toContain("source.title || source.label || 'Source record'");
    expect(script).toContain("createGuidedMobileStickyHeader(guidedResponse, chemicalData)");
    expect(styles).toContain('.guided-mobile-sticky');
    expect(styles).toContain('grid-template-columns: 1fr;');
    expect(styles).toContain('.guided-command-flow-grid { grid-template-columns: 1fr; }');
  });

  it("prioritizes a source-backed SCBA decision and omits manufacturer lists", () => {
    expect(builder).toContain("const recommendation = profile.ppeRecommendation");
    expect(builder).toContain("'SCBA MANDATED'");
    expect(builder).toContain("recommendation.scbaRequired");
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    expect(renderer).not.toContain("createGuidedManufacturerPanel");
    expect(renderer).not.toContain("respiratorRecommendations are not displayed");
  });

  it("uses one fail-closed protection level and a controlled Level C cartridge status", () => {
    for (const level of [
      "Vapor Protective Level A w/ SCBA",
      "Level B w/ SCBA",
      "Level C w/ APR — Appropriate Cartridge Required",
      "Level D — No Chemical Protection Required",
      "Requires IC / HazMat Specialist Review",
    ]) expect(ppeEngine).toContain(level);
    expect(ppeEngine).toContain("failedLevelCChecks");
    expect(ppeEngine).toContain("conditions.cartridgeVerified === true");
    expect(ppeEngine).toContain("conditions.concentrationBelowLimits === true");
    expect(script).not.toContain("const ppeLevelTiles");
    expect(script).toContain("Source Details / Manufacturer Details");
  });

  it("uses the same concise PPE recommendation in Profile, Incident Dashboard, and Guided Response", () => {
    const profilePpeRenderer = script.slice(
      script.indexOf("{ key: 'ppeRespiratory'"),
      script.indexOf("{ key: 'detectors'"),
    );
    const incidentPpeRenderer = script.slice(
      script.indexOf('function buildIncidentPpeSummary'),
      script.indexOf('function buildIncidentMedicalSummary'),
    );
    expect(profilePpeRenderer).toContain('createPpeRecommendationCard(profile?.ppeRecommendation)');
    expect(profilePpeRenderer).not.toContain('recommendedPpe');
    expect(profilePpeRenderer).not.toContain('respiratorRecommendations');
    expect(incidentPpeRenderer).toContain('record?.profile?.ppeRecommendation');
    expect(builder).toContain('profile.ppeRecommendation');
    expect(script).toContain('ppeRecommendation: profile.ppeRecommendation');
    expect(script).toContain('PPE recommendations are source-backed planning guidance');
  });

  it("renders one highlighted source-backed PPE recommendation and keeps raw options collapsed", () => {
    expect(script).not.toContain('ppe-level-options');
    expect(script).not.toContain('ppe-level-option');
    expect(script).toContain("const rawDetails = document.createElement('details')");
    expect(script).not.toContain('rawDetails.open = true');
    expect(styles).toContain('#chemical-id-results .ppe-recommendation-status');
    expect(styles).toContain('border: 3px solid #f6c343;');
  });

  it("keeps PPE action first and exposes downgrade blockers as verification items", () => {
    expect(builder).toContain("Respiratory downgrade");
    expect(builder).toContain("Verify oxygen concentration and air monitoring before entry");
    expect(script).toContain("stage.status === 'ACTION REQUIRED' ? 'ACTION REQUIRED' : 'RECOMMENDED INITIAL ACTION'");
    expect(script).toContain("VERIFICATION ITEMS");
  });

  it("builds an export-ready decision record and keeps mitigation under IC approval", () => {
    expect(script).toContain("tacticalDecisionFlow: {");
    expect(script).toContain("identifyAnalyze: decisions.identifyAnalyze");
    expect(script).toContain("verifyIsolate: decisions.verifyIsolate");
    expect(script).toContain("lifeSafety: decisions.lifeSafety");
    expect(script).toContain("mitigation: decisions.mitigation");
    expect(builder).toContain("'Defensive'");
    expect(script).toContain("mitigationDecisionSupport: decisions.mitigationDecisionSupport");
    expect(script).toContain("readyForIncidentExport: true");
    expect(script).toContain("Final mitigation strategy must be approved by Incident Command.");
    expect(builder).toContain("const defensiveTriggers = unique");
  });

  it("uses section-level source summaries instead of badges on every populated row", () => {
    expect(script).toContain("guided-flow-sources");
    expect(script).toContain("Sources reviewed: ${sources.length ? sources.join(', ') : noCurrentDataText}");
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    expect(renderer).not.toContain("guided-source-badge");
  });

  it("removes the repeating Chemical Profile card grid from the active renderer", () => {
    const renderer = script.slice(script.indexOf("function renderGuidedResponse()"), script.indexOf("const chemicalSearchForm"));
    for (const removed of [
      "Confirm Chemical Identity",
      "Immediate Hazards",
      "PPE / Respiratory",
      "Isolation / Protective Actions",
      "Medical / First Aid",
      "Decon / Spill / Fire",
      "Plume Readiness",
    ]) expect(renderer).not.toContain(removed);
    expect(renderer).not.toContain("guided-response-main");
  });

  it("saves a compact tactical record locally and can attach it to an active incident", () => {
    expect(script).toContain("function saveGuidedResponseTacticalRecord");
    expect(script).toContain("guidedResponseTacticalStorageKey");
    expect(script).toContain("guidedResponseTacticalRecord: record");
    expect(script).toContain("Planning Mode — tactical decision record saved locally, not attached to an incident.");
    expect(script).toContain("Active Incident Mode — tactical decision record saved to this incident.");
  });
});
