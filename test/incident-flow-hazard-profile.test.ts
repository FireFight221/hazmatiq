import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../server/public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const compareScript = readFileSync(new URL("../server/public/chem-compare.js", import.meta.url), "utf8");
const incidentStyles = readFileSync(new URL("../server/public/incident-overrides.css", import.meta.url), "utf8");
const chemicalStyles = readFileSync(new URL("../server/public/chemical-intel.css", import.meta.url), "utf8");
const profilePageStyles = readFileSync(new URL("../server/public/hazard-profile-page.css", import.meta.url), "utf8");
const guidedStyles = readFileSync(new URL("../server/public/guided-response-overrides.css", import.meta.url), "utf8");

describe("Incident decision flow and Hazard ID profile loading", () => {
  it("keeps Incident Command summary cards compact and inventory independent", () => {
    const active = html.slice(
      html.indexOf('<div id="incident-command-active">'),
      html.indexOf('<div id="incident-command-main-grid">'),
    );
    const summaryStart = active.indexOf('<section class="incident-command-info-grid"');
    const summary = active.slice(summaryStart, active.indexOf('</section>', summaryStart));
    expect(summary.match(/<article class="incident-info-card/g)).toHaveLength(3);
    expect(summary).toContain('incident-involved-chemicals-compact');
    expect(active).not.toContain('incident-involved-chemicals-panel');
    expect(active.indexOf('class="incident-command-flow"')).toBeLessThan(summaryStart);
    expect(active.indexOf('class="incident-command-flow"')).toBeLessThan(active.indexOf('id="incident-command-weather-bar"'));
    expect(active).toContain('id="incident-involved-chemical-count"');
    expect(active).toContain('id="incident-view-all-involved-chemicals-btn"');
    expect(html).toContain('id="incident-involved-chemicals-dialog"');
    expect(html).toContain('id="incident-involved-chemicals-dialog-list"');
    expect(incidentStyles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(incidentStyles).toContain('#incident .incident-info-card {');
    expect(incidentStyles).toContain('height: auto;');
    expect(incidentStyles).toContain('#incident .incident-involved-chemicals-compact');
    expect(incidentStyles).toContain('@media (max-width: 720px)');
  });

  it("keeps full inventory in a dialog and the plume selection separate", () => {
    expect(script).toContain("incident-involved-chemical-count");
    expect(script).toContain("openIncidentInvolvedChemicalsDialog");
    expect(html).toContain("Facility inventory additions do not change it.");
    expect(script).toContain("const involvedChemicals = Array.isArray(nextIncident.involvedChemicals)");
  });

  it("uses the five requested command decisions", () => {
    const flowStart = html.indexOf('<section class="incident-command-flow"');
    const flow = html.slice(flowStart, html.indexOf('</section>', flowStart));

    expect(flow.match(/<article>/g)).toHaveLength(5);
    for (const title of [
      "1. Scene Size-Up",
      "2. Public Protection",
      "3. Plume Model",
      "4. Tactical Decision",
      "5. Document / Report",
    ]) expect(flow).toContain(title);
    expect(flow).not.toContain('class="incident-flow-status"');
    expect(flow).not.toContain('class="incident-flow-details"');
    expect(incidentStyles).toContain('border: 2px solid #fff;');
    expect(flow).toMatch(/1\. Scene Size-Up[\s\S]*data-incident-command-action="chemical-profile"[^>]*>Open Hazard Profile/);
    expect(flow.match(/class="incident-flow-chevron"/g)).toHaveLength(4);
    expect(incidentStyles).toContain("grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr)");
    expect(incidentStyles).toContain("#incident .incident-flow-chevron::after { content: '↓';");
  });

  it("keeps commander status controls tied to one canonical task and readable on small screens", () => {
    expect(script).toContain("row.className = 'incident-command-status-row';");
    expect(script).toContain("identity.textContent = task.label;");
    expect(script).toContain("row.append(identity, control, badge);");
    expect(script).toContain("select.dataset.taskId = task.id;");
    expect(incidentStyles).toContain(".incident-command-status-list");
    expect(incidentStyles).toContain(".incident-command-status-control");
    expect(incidentStyles).toContain("@media (max-width: 560px)");
    expect(script).not.toContain("incident-command-guided-recommendation");
  });

  it("renders the authoritative chemical profile independently of optional enrichment", () => {
    const loader = script.slice(
      script.indexOf("async function openChemical(chemical"),
      script.indexOf("function companionChemicalForUi"),
    );

    expect(loader).toContain("chemical.guidanceEligible === false");
    expect(loader).toContain("const recordPromise = buildFullChemicalRecord(chemical).catch");
    expect(loader).toContain("profileResponse = await fetchJson(profileUrl);");
    expect(loader.indexOf("updateChemicalCard(profileRecord);")).toBeLessThan(loader.indexOf("void recordPromise.then((record) =>"));
    expect(loader).toContain("const isCurrentProfileRequest = () => profileRequestId === latestChemicalProfileRequest");
    expect(loader).toContain("if (!profile) {");
    expect(loader).toContain("Database information for ${chosenChemicalName || 'this chemical'} could not be loaded.");
    expect(loader).toContain("setHazardProfileMode('chemical');");
    expect(loader).toContain("updateChemicalCard(profileRecord);");
  });

  it("loads and refreshes weather independently of the plume basemap", () => {
    const plumeRefresh = script.slice(
      script.indexOf("async function refreshPlumeWorkspace"),
      script.indexOf("let plumeAutomaticCalculationTimer"),
    );

    expect(script).toContain("fetchJson(`/api/weather/current?${proxyQuery}`, { timeoutMs: 10000 })");
    expect(script).toContain("notificationWeatherLocation = { lat: location.lat, lon: location.lon };");
    expect(script).toContain("? { ...openMeteo, headerSource: 'Open-Meteo current conditions' }");
    expect(script).toContain("function convertWindSpeedToMph(value, unit = 'mph')");
    expect(script).toContain("return speed * 0.621371;");
    expect(plumeRefresh).toContain("const mapReadyPromise = Promise.resolve().then(() => ensurePlumeMap(location))");
    expect(plumeRefresh.indexOf("const { openMeteo, nws } = await fetchWeatherSources")).toBeLessThan(
      plumeRefresh.indexOf("await Promise.all([mapReadyPromise, chemicalReady]);"),
    );
  });

  it("uses exclusive full-page search and Chemical Profile states", () => {
    const profileToolbar = html.slice(
      html.indexOf('<header class="chemical-profile-toolbar">'),
      html.indexOf('<article class="panel-card chemical-profile-header-card">'),
    );

    expect(html).toContain('id="lookup" class="view hazard-id-page" data-page-root="hazard-id"');
    expect(html).toContain('id="hazard-id-search-hero"');
    expect(html).toContain('id="hazard-id-search-workspace"');
    expect(profileToolbar).toContain('id="chemical-profile-back-btn"');
    expect(profileToolbar).toContain('id="open-chemcompare-btn"');
    expect(profileToolbar).toContain('id="open-guided-response-btn"');
    expect(profileToolbar).toContain('id="open-plume-btn"');
    expect(profileToolbar).not.toContain('id="profile-export-btn"');
    expect(profileToolbar).not.toContain('id="profile-save-chemical-btn"');
    expect(script).toContain("lookup.dataset.hazardPageState = mode === 'chemical'");
    expect(script).toContain("if (searchHero) searchHero.hidden = !searchState;");
    expect(chemicalStyles).not.toMatch(/#chemical-id-results \.chem-compare\s*\{[^}]*display:\s*none;/s);
    expect(profilePageStyles).toContain('#lookup.view[data-hazard-page-state="chemical-profile"]');
    expect(profilePageStyles).toContain("min-height: calc(100dvh - 24px) !important;");
    expect(compareScript).toContain("showView('lookup', { preserveHazardState: true });");
  });

  it("uses the shared compact page header on Guided Response", () => {
    expect(html).toContain('class="hazmat-page-hero hazmat-page-hero-compact emergenz-page-header variant-guided-response guided-response-page-header"');
    expect(html).toContain('class="emergenz-page-header-icon"');
  });

  it("maps selected chemical profile fields into every operational consumer", () => {
    expect(script).toContain("function selectedChemicalOperationalData(");
    expect(script).toContain("profile.exposures?.idlh");
    expect(script).toContain("profile.header?.hazardClass");
    expect(script).toContain("hazardClass: chemicalData.hazardClass || ''");
    expect(script).toContain("idlh: chemicalData.idlh || ''");
    expect(script).toContain("const chemicalData = selectedChemicalOperationalData({ ...chemicalContext, profile: chemicalProfile });");
    expect(script).toContain("const chemicalData = selectedChemicalOperationalData({");
    expect(script).toContain("nioshSourceId: firstChemicalDataValue(niosh.sourceRecordId, incidentHasCanonicalIdentity ? incident?.nioshSourceId : null)");
    expect(script).toContain("model.nioshSourceId ? `Source NIOSH · ${model.nioshSourceId}` : 'Source / review not available'");
    expect(script).toContain("chemicalSources: chemicalProfile ? chemicalProfileSources(chemicalProfile) : (existingIncident?.chemicalSources || [])");
    expect(script).toContain("const ppeSource = profile.ppeRecommendation || profile.ppeRespiratory || incident.ppeSummary;");
    expect(script).toContain("const persistedMedicalSource = incident.medicalSummary || profile.medical;");
    expect(script).toContain("const medicalSource = profile.medical || persistedMedicalSource;");
    expect(script).toContain("status: operationalStatus(ppeSource?.status || ppeSource?.recommendationStatus");
  });

  it("uses compact expandable Guided Response decision panels", () => {
    expect(script).toContain("const box = document.createElement('details');");
    expect(script).toContain("box.open = title === 'Life Safety';");
    expect(script).toContain("chemicalStrip.className = 'guided-chemical-strip';");
    expect(guidedStyles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(guidedStyles).toContain("#guided-response .guided-flow-arrow");
    expect(guidedStyles).toContain("background: #0b2944;");
  });
});
