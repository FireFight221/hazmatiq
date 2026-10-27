import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const module = readFileSync(new URL('../server/public/incident-command.js', import.meta.url), 'utf8');
const incidentOverrides = readFileSync(new URL('../server/public/incident-overrides.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../server/public/styles.css', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../server/public/reports.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/src/app.ts', import.meta.url), 'utf8');

function moduleApi() {
  const context = {
    window: {
      HazMatIQ: {
        isIncidentPlumeCurrent: (plume: unknown, incident: Record<string, unknown>) => {
          const candidate = plume as Record<string, unknown> | null;
          const chemical = candidate?.chemical as Record<string, unknown> | null;
          return Boolean(candidate
            && String(candidate.incidentId || '') === String(incident.incidentId || '')
            && String(chemical?.masterChemicalId || chemical?.selectedChemicalId || '') === String(incident.selectedChemicalId || incident.chemicalCompanionId || ''));
        },
      },
    },
    document: { getElementById: () => null },
  } as Record<string, unknown>;
  runInNewContext(module, context);
  return (context.window as { HazMatIQ: Record<string, (...args: unknown[]) => unknown> }).HazMatIQ;
}

describe('Incident Command operational hub', () => {
  it('loads as the page-owned module and provides direct command actions', () => {
    expect(html.indexOf('<script src="incident-command.js"></script>')).toBeGreaterThan(html.indexOf('<script src="script.js'));
    expect(html).toContain('id="ic-command-actions"');
    expect(html).toContain('id="ic-chemical-summary"');
    expect(html).toContain('data-incident-command-action="chemical-profile"');
    expect(html).toContain('id="ic-plume-preview-image"');
    expect(script).toContain("if (targetId === 'incident') window.HazMatIQ.initializeIncidentCommand?.(context);");
    expect(script).toContain("window.dispatchEvent(new CustomEvent('hazmatiq:incident-command-updated'");
    expect(reports).toContain('context.incidentId');
  });

  it('keeps incident navigation in Reports without an extra Command tab bar', () => {
    expect(html).not.toContain('incident-response-tabs');
    expect(script).not.toContain('renderIncidentResponseTabs');
    expect(html).toContain('id="current-incident-list"');
    expect(script).toContain('function switchActiveIncident');
  });

  it('uses two command cards and keeps the active-incident decision actions in Guided Response', () => {
    const activeCommand = html.slice(html.indexOf('<div class="incident-command-main-grid">'), html.indexOf('<section class="incident-command-panel incident-command-tools"'));
    expect(activeCommand.match(/class="incident-command-panel /g)).toHaveLength(5);
    expect(activeCommand).toContain('incident-command-brief-panel');
    expect(activeCommand).toContain('incident-command-guided-panel');
    expect(activeCommand).toContain('incident-command-plume-summary-inline');
    expect(activeCommand).not.toContain('Operational Status');
    expect(activeCommand).toContain('incident-command-card-icon-brief');
    expect(activeCommand).toContain('incident-command-card-icon-guided');
    expect(activeCommand).toContain('M12 10 24 6l12 4v11');
    expect(activeCommand).toContain('m16 14 16 16M32 14 16 30');
    expect(activeCommand).toContain('<span class="incident-command-panel-title">Operational Guidance</span>');
    for (const [view, label] of [['lookup', 'Chemical / PPE'], ['plume', 'Plume Model'], ['map', 'Live Map'], ['report', 'Incident Reports']]) {
      expect(activeCommand).toContain(`data-command-view="${view}"`);
      expect(activeCommand).toContain(`>${label}</button>`);
    }
    expect(styles).toContain('grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);');
    expect(html).not.toContain('class="incident-command-overview-strip"');
    expect(html).toContain('id="incident-command-flow-title"><span>COMMAND</span><span>FLOW</span>');
    expect(html).not.toContain('Next operational decision');
    expect(incidentOverrides).toContain('#incident .incident-command-flow-title');
    expect(incidentOverrides).toContain('.incident-flow-chevron');
    expect(incidentOverrides).toContain('#incident .incident-command-flow {');
    expect(incidentOverrides).toContain('background: transparent;');
  });

  it('centers the dashboard card icons and preserves Command Status controls across timer renders', () => {
    expect(html).toContain('<h3 id="ic-guided-status-heading" aria-label="Commander Status &amp; Confirmation">Command Status</h3>');
    expect(html).toContain('aria-labelledby="ic-guided-status-heading"');
    expect(incidentOverrides).toContain('grid-template-columns: auto minmax(0, 1fr) auto;');
    expect(incidentOverrides).toContain('width: 26px; height: 26px;');
    expect(incidentOverrides).toContain('width: 26px;');
    expect(script).toContain('const statusRenderKey = model.operationalChecklist.tasks.map');
    expect(script).toContain('statusList.dataset.renderKey === statusRenderKey');
    expect(script).toContain('control.append(select);');
    expect(script).toContain('row.append(identity, control, badge);');
    expect(script).not.toContain('System signal only; commander confirmation is required.');
    expect(script).toContain('resizePlumeMapAfterLayout();');
    expect(styles).toContain('grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr) max-content;');
    expect(styles).toContain('.incident-command-status-row > .incident-command-status-support');
    expect(incidentOverrides).toContain('grid-template-columns: minmax(180px, 1fr) minmax(170px, 220px) max-content !important;');
    expect(incidentOverrides).toContain('grid-column: 2 !important;');
    expect(incidentOverrides).toContain('grid-column: 3 !important;');
  });

  it('orders the command dashboard content for desktop and responsive layouts', () => {
    expect(incidentOverrides).toContain('#incident .incident-command-info-grid { order: 1;');
    expect(incidentOverrides).toContain('#incident .incident-command-flow { order: 2;');
    expect(incidentOverrides).toContain('#incident .incident-command-weather-bar { order: 4;');
    expect(incidentOverrides).toContain('#incident .incident-command-tools { order: 5;');
    expect(incidentOverrides).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(incidentOverrides).toContain('border: 1px solid #f1f5f9 !important;');
    expect(incidentOverrides).toContain('width: 100%;');
    expect(styles).toContain(".incident-command-operational-details[open] > summary::after");
    expect(styles).toContain('.incident-command-tool-danger { min-height: 52px;');
    expect(script).toContain("incidentOperationalSummary.setAttribute('aria-expanded'");
  });

  it('keeps Operational Details in normal flow without changing the viewport', () => {
    expect(styles).toContain('display: block; position: static; flex: 0 0 auto; order: initial;');
    expect(styles).toContain('.incident-command-operational-details > summary { position: static; display: flex;');
    expect(script).not.toContain('details?.scrollIntoView');
    expect(script).toContain('const preserveIncidentOperationalScroll = () =>');
    expect(script).toContain('incidentOperationalSummary.addEventListener(\'keydown\'');
    expect(incidentOverrides).toContain('#incident .incident-command-flow {');
    expect(incidentOverrides).toContain('box-shadow: none;');
  });

  it('keeps weather separated from a restrained Command Tools frame', () => {
    expect(incidentOverrides).toContain('#incident .incident-command-weather-bar { margin: 10px 0 10px; padding: 12px 8px 8px; }');
    expect(incidentOverrides).toContain('border: 2px solid #ffd400; background: #082540; box-shadow: none;');
    expect(styles).toContain('[class*="-panel "]:not(.incident-command-tools)');
  });

  it('keeps the involved-chemicals dialog close control readable on its light surface', () => {
    expect(html).toContain('id="close-incident-involved-chemicals-btn"');
    expect(incidentOverrides).toContain('.incident-involved-chemicals-dialog-header > .ghost-btn');
    expect(incidentOverrides).toContain('color: #071f36 !important; background: #e5e7eb !important;');
  });

  it('keeps the plume summary inside Incident Brief and uses one incident-level assignment editor', () => {
    const brief = html.slice(html.indexOf('incident-command-brief-panel'), html.indexOf('incident-command-guided-panel'));
    expect(brief).toContain('incident-command-plume-summary-inline');
    expect(brief).toContain('id="ic-assignment-editor-section"');
    expect(brief).toContain('class="incident-command-panel incident-command-operational-details"');
    expect(html).toContain('id="ic-assignment-editor-section"');
    expect(html).toContain('id="ic-manage-assignments-btn"');
    expect(html).toContain('Incident Assignments for Live Map and ICS/Reports.');
    expect(html).toContain('id="ic-plume-preview-map"');
    expect(html).not.toContain('class="incident-assignment-phase"');
    expect(script).toContain("function persistIncidentAssignment(assignment, previousPhaseId = '')");
    expect(incidentOverrides).toContain('grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr);');
    expect(incidentOverrides).toContain('.incident-command-plume-map');
    expect(incidentOverrides).toContain('grid-template-rows: auto !important;');
    expect(incidentOverrides).toContain('grid-row: 2 !important;');
    expect(incidentOverrides).toContain('border: 1px solid #315d7d !important;');
    expect(incidentOverrides).toContain('grid-template-columns: 1fr;');
    expect(incidentOverrides).toContain('width: 100%;');
    expect(incidentOverrides).toContain('box-sizing: border-box;');
    expect(script).toContain("canvas.width >= 900 ? canvas.toDataURL('image/jpeg', 0.86)");
    expect(incidentOverrides).toContain('background: #fff !important;');
    expect(incidentOverrides).toContain('color: #166534 !important;');
    expect(incidentOverrides).toContain('background: #f1f3f5 !important;');
    expect(incidentOverrides).toContain('color: #102a43 !important;');
  });

  it('renders incident assignments with structured crew, detail, status, and action areas', () => {
    expect(script).toContain("content.className = 'incident-assignment-item-content';");
    expect(script).toContain("assigned.className = 'incident-assignment-item-assigned';");
    expect(script).toContain("detailGrid.className = 'incident-assignment-item-details';");
    expect(script).toContain("meta.className = 'incident-assignment-item-meta';");
    expect(script).toContain('meta.append(state, actions);');
    expect(script).toContain('item.append(content, meta);');
    expect(incidentOverrides).toContain('.incident-assignment-table-header');
    expect(incidentOverrides).toContain('grid-template-columns: minmax(125px, 1.65fr)');
    expect(incidentOverrides).toContain('.incident-assignment-item-assigned');
    expect(incidentOverrides).toContain('.incident-assignment-item-details');
    expect(incidentOverrides).toContain('.incident-assignment-item-meta');
    expect(incidentOverrides).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('binds commander status controls to canonical checklist IDs and requires visible completion evidence', () => {
    expect(script).toContain("const operationalStatusOptions = Object.freeze(['Not Started', 'In Progress', 'Complete', 'Not Applicable']);");
    expect(script).toContain('model.operationalChecklist.tasks.forEach((task) =>');
    expect(script).toContain("select.dataset.taskId = task.id;");
    expect(script).toContain("if (status === 'Complete' && !confirmation) return null;");
    expect(script).toContain('Complete requires commander evidence. The status was not changed.');
    expect(script).toContain("{ id: 'medical-rehab', label: 'Medical and rehab'");
    expect(script).not.toContain("medical: 'documentation'");
    expect(script).not.toContain("model.operationalChecklist.tasks.find((candidate) => candidate.id === item.id)");
  });

  it('normalizes one incident state for chemical, plume, command, and report consumers', () => {
    const api = moduleApi();
    const state = api.normalizeIncidentState({
      incidentId: 'incident-1', incidentName: 'Hydrazine Tank Leak', status: 'Active',
      address: '1 Main St', latitude: '33.5', longitude: '-86.8',
      chemicalName: 'Hydrazine', selectedChemicalId: 54, casNumber: '302-01-2', unNumber: '2029', ergGuide: '132',
      hazardClass: '3 (Flammable liquid)', sourceStatuses: { chemical: 'Verified Source' },
      objectives: 'Isolate release area\nIdentify leak point',
      commandStructure: 'IC / HazMat Group / Safety', communications: 'Channel 3',
      medicalPlan: 'EMS staging', stagingResources: 'South lot',
      plumeModelResults: {
        incidentId: 'incident-1',
        chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
        output: { threatZones: [{ threatRank: 3 }] },
      }, plumeMapImage: 'data:image/jpeg;base64,preview',
      incidentNotes: [{ text: 'Initial size-up' }],
    });
    expect(state).toMatchObject({
      incidentId: 'incident-1', location: '1 Main St',
      activeChemical: { canonicalId: '54', displayName: 'Hydrazine', chemicalCompanionId: 54, cas: '302-01-2' },
      plume: { status: 'PLOTTED', mapImage: 'data:image/jpeg;base64,preview' },
      command: { objectives: ['Isolate release area', 'Identify leak point'], structure: 'IC / HazMat Group / Safety' },
    });
  });

  it('keeps facility-involved chemicals separate from the single explicitly selected plume chemical', () => {
    const api = moduleApi();
    const state = api.normalizeIncidentState({
      incidentId: 'incident-multi-chemical',
      chemicalName: 'Chlorine',
      selectedChemicalId: 22,
      involvedChemicals: [
        { chemicalId: 'chlorine', chemicalName: 'Chlorine', cas: '7782-50-5' },
        { chemicalId: 'ammonia', chemicalName: 'Ammonia', un: '1005' },
      ],
    });
    expect(state).toMatchObject({
      activeChemical: { displayName: 'Chlorine', canonicalId: '22' },
      activeChemicals: [
        { displayName: 'Chlorine', cas: '7782-50-5' },
        { displayName: 'Ammonia', un: '1005' },
      ],
      involvedChemicals: [
        { displayName: 'Chlorine' },
        { displayName: 'Ammonia' },
      ],
    });
  });

  it('maps the canonical incident state to reusable ICS prefill data', () => {
    const api = moduleApi();
    const prefill = api.buildIcsPrefill({
      incidentId: 'incident-2', incidentName: 'Hydrazine Tank Leak', incidentNumber: 'H-2',
      startDate: '09/17/2026', startTime: '10:00 AM', address: '1 Main St',
      chemicalName: 'Hydrazine', selectedChemicalId: 54, casNumber: '302-01-2', unNumber: '2029', ergGuide: '132',
      involvedChemicals: [
        { chemicalId: 'hydrazine', chemicalName: 'Hydrazine', cas: '302-01-2', un: '2029' },
        { chemicalId: 'ammonia', chemicalName: 'Ammonia', un: '1005' },
      ],
      objectives: 'Isolate release area\nIdentify leak point', commandStructure: 'IC / HazMat Group / Safety',
      communications: 'Channel 3', medicalPlan: 'EMS staging', stagingResources: 'South lot',
      notes: 'Initial size-up',
      guidedResponseTacticalRecord: {
        selectedTacticalMode: 'Offensive',
        mitigationDecisionSupport: { tacticalPostureSource: 'Incident Command selection' },
        tacticalDecisionFlow: {
          mitigation: { specificValues: { vaporFireControl: 'Control ignition sources', requiredVerification: ['Field monitoring'] } },
        },
      },
    }) as Record<string, unknown>;
    expect(prefill).toMatchObject({
      incidentId: 'incident-2',
      shared: { incidentName: 'Hydrazine Tank Leak', incidentLocation: '1 Main St' },
      forms: {
        '202': { objectives: 'Isolate release area\nIdentify leak point' },
        '203': { commandStructure: 'IC / HazMat Group / Safety' },
        '205': { communications: 'Channel 3' },
        '206': { medicalPlan: 'EMS staging' },
        '204': { assignments: 'South lot' },
        '208': { safetyMessage: expect.stringContaining('Tactical mode: Offensive') },
        '215A': { safetyAnalysis: expect.stringContaining('Selected tactical mode: Offensive') },
      },
    });
    const form201 = (prefill.forms as Record<string, { situationSummary: string }>)['201'];
    expect(form201.situationSummary).toContain('Chemicals identified as involved: Hydrazine, CAS 302-01-2, UN 2029; Ammonia, UN 1005');
    expect(form201.situationSummary).toContain('Explicit plume chemical: Hydrazine');
    expect(server).toContain('normalized.includes("objectives")');
    expect(server).toContain('normalized.includes("communicationsplan")');
  });

  it('does not promote a text-only incident label into a canonical chemical profile', () => {
    const api = moduleApi();
    const state = api.normalizeIncidentState({
      incidentId: 'incident-text-only', incidentName: 'Unresolved release', status: 'Active',
      chemicalName: 'Ammonia',
    }) as { activeChemical: unknown; plume: { status: string } };
    expect(state.activeChemical).toBeNull();
    expect(state.plume.status).toBe('NOT PLOTTED');
  });

  it('consumes the saved plume result without creating another model', () => {
    expect(module).toContain('source.plumeModelResults || null');
    expect(module).toContain('source.plumeMapImage ||');
    expect(module).toContain("sourceState: source.sourceStatuses?.chemical || NO_DATA");
    expect(module).not.toContain('runPlume(');
    expect(module).not.toContain('ensurePlumeMap(');
    expect(script).toContain('function openPlumeModel(context = {})');
    expect(script).toContain('function savePlumeResult(command, workflowRecord, mapImage = \'\')');
  });

  it('reserves red life-safety emphasis for IDLH rows', () => {
    expect(script).toContain("['IDLH', model.idlh, true, 'idlh']");
    expect(script).not.toContain("['Primary Hazard', model.primaryHazard, true]");
    expect(script).not.toContain("['Medical Concerns', model.medicalConcerns, true]");
    expect(script).not.toContain("item.lifeSafety ? ' is-life-safety' : ''");
    expect(incidentOverrides).toContain('.incident-command-brief-list .is-idlh');
    expect(incidentOverrides).not.toContain('.incident-command-brief-list .is-life-safety');
    expect(incidentOverrides).not.toContain('.incident-command-tactical-row.is-life-safety');
  });

  it('propagates starter-hazard identity and preserves the existing safety boundary', () => {
    expect(script).toContain('propagateHazardToIncident?.(result, profile);');
    expect(module).toContain('chemicalProfile: viewProfile');
    expect(module).toContain('sourceStatuses: { ...(incident.sourceStatuses || {}), chemical: normalized.sourceState || NO_DATA }');
    expect(script).toContain('window.HazMatIQ?.openChemCompareWithBase?.(chemical);');
  });
});
