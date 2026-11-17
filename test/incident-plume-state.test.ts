import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const command = readFileSync(new URL('../server/public/incident-command.js', import.meta.url), 'utf8');

function plumeIdentityApi() {
  const start = script.indexOf('function normalizedChemicalName');
  const end = script.indexOf('function cleanIncidentOperationalMode');
  const context = {
    normalizeChemicalSelectionId: (value: unknown) => value,
  } as Record<string, unknown>;
  runInNewContext(`${script.slice(start, end)}; this.isIncidentPlumeCurrent = isIncidentPlumeCurrent;`, context);
  return context.isIncidentPlumeCurrent as (plume: unknown, incident: unknown) => boolean;
}

describe('Incident Command plume ownership', () => {
  it('does not label a stale saved map-image reference as PLOTTED', () => {
    const nodes = new Map<string, { textContent: string; hidden: boolean; dataset: Record<string, string>; removeAttribute: ReturnType<typeof vi.fn>; replaceChildren: ReturnType<typeof vi.fn>; append: ReturnType<typeof vi.fn> }>();
    const node = () => ({ textContent: '', hidden: false, dataset: {}, removeAttribute: vi.fn(), replaceChildren: vi.fn(), append: vi.fn() });
    const render = vi.fn(() => true);
    const code = command.slice(command.indexOf('  function renderPlumeSummary('), command.indexOf('  function hydratePlumePreview('));
    runInNewContext(`${code}; renderPlumeSummary(state)`, {
      state: { plume: { status: 'PLUME REQUIRES RECALCULATION', result: null }, raw: { plumeMapImageRef: 'old-snapshot' } },
      NO_DATA: 'Not recorded', window: { HazMatIQ: { commandPlumePreview: { render } } },
      document: { createElement: node, getElementById: (id: string) => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); } },
    });
    expect(nodes.get('ic-plume-status')?.textContent).toBe('PLUME REQUIRES RECALCULATION');
    expect(nodes.get('ic-plume-preview-map')?.hidden).toBe(true);
    expect(render).not.toHaveBeenCalled();
  });
  it('rejects a saved result invalidated by changed release or weather inputs', () => {
    const isCurrent = plumeIdentityApi();
    const incident = { incidentId: 'audit-ammonia', selectedChemicalId: 10, chemicalName: 'Ammonia (anhydrous)' };
    const plume = { incidentId: incident.incidentId, chemical: { masterChemicalId: 10, chemicalName: incident.chemicalName } };
    expect(isCurrent(plume, incident)).toBe(true);
    expect(isCurrent({ ...plume, requiresRecalculation: true }, incident)).toBe(false);
    expect(isCurrent({ ...plume, plumeResult: plume, requiresRecalculation: true }, incident)).toBe(false);
  });

  it('detects incident-side weather and release edits while allowing unrelated notes', () => {
    const start = script.indexOf('function normalizedChemicalName');
    const end = script.indexOf('function cleanIncidentOperationalMode');
    const incident = { incidentId: 'audit', selectedChemicalId: 10, chemicalName: 'Ammonia (anhydrous)', quantity: '10 lb/min', windSpeed: '5' };
    const context = { normalizeChemicalSelectionId: (value: unknown) => value, incident };
    const check = runInNewContext(`${script.slice(start, end)}; const plume={incidentId:incident.incidentId,chemical:{masterChemicalId:10,chemicalName:incident.chemicalName},incidentInputSnapshot:plumeIncidentInputSnapshot(incident)}; (patch)=>isIncidentPlumeCurrent(plume,{...incident,...patch})`, context);
    expect(check({ notes: 'Unrelated note' })).toBe(true);
    expect(check({ windSpeed: '15' })).toBe(false);
    expect(check({ quantity: '20 lb/min' })).toBe(false);
  });
  it('rejects a Hydrazine plume when Ammonia is the active incident', () => {
    const isCurrent = plumeIdentityApi();
    expect(isCurrent({
      incidentId: 'incident-ammonia',
      chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(false);
  });

  it('accepts only a current incident plume with matching chemical identity', () => {
    const isCurrent = plumeIdentityApi();
    expect(isCurrent({
      incidentId: 'incident-ammonia',
      chemical: { masterChemicalId: 12, chemicalName: 'Ammonia (anhydrous)' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(true);
    expect(isCurrent({
      incidentId: 'incident-hydrazine',
      chemical: { masterChemicalId: 54, chemicalName: 'Hydrazine' },
    }, {
      incidentId: 'incident-ammonia',
      selectedChemicalId: 12,
      chemicalName: 'Ammonia (anhydrous)',
    })).toBe(false);
  });

  it('keeps planning plumes out of active-incident command summaries', () => {
    const model = script.slice(script.indexOf('function buildIncidentCommandViewModel'), script.indexOf('function incidentCommandPhaseStatusClass'));
    expect(model).toContain('const incidentPlumeCandidate = incident.plumeModelResults || null;');
    expect(model).toContain('isIncidentPlumeCurrent(incidentPlumeCandidate, incident)');
    expect(model).not.toContain('planning.plumeModelResults || readIncidentCommandStorage');
  });

  it('validates workflow ownership before saving to an active incident', () => {
    const save = script.slice(script.indexOf('function savePlumeResult'), script.indexOf('function saveLatestPlumeOverlay'));
    expect(save).toContain('if (!isIncidentPlumeCurrent(workflowRecord, activeIncident))');
    expect(save).toContain('PLUME SAVE BLOCKED — ACTIVE INCIDENT / PLUME CHEMICAL MISMATCH');
  });

  it('keeps the command preview live while protecting async incident switching', () => {
    expect(command).toContain('readIncidentMapSnapshot');
    expect(command).toContain('current?.incidentId !== state?.incidentId');
    expect(command).toContain('current?.raw?.plumeMapImageRef !== imageRef');
    expect(command).toContain('generation !== plumePreviewHydration.generation');
    expect(command).toContain('commandPlumePreview?.render?.(state)');
    expect(command).toContain('image.hidden = true;');
    expect(command).toContain('state?.plume?.result');
    expect(command).toContain('PLUME REQUIRES RECALCULATION');
    expect(script).toContain('paintedFrames >= 2 && cameraSettled');
    expect(script).not.toContain('incident.plumeModelResults || planning.plumeModelResults ||');
  });
});
