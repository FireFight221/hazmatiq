import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../server/public/index.html', import.meta.url), 'utf8');
const program = parse(script, { ecmaVersion: 'latest' });
function declaration(name: string) {
  const node = program.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}
function panelData(result: object | null, intelligence = {}) {
  return runInNewContext(`${declaration('threatZonePanelData')}\nthreatZonePanelData(result, intelligence)`, {
    result, intelligence, formatThreatZoneArea: vi.fn(), threatZoneAreaSquareMeters: vi.fn(),
    document: { getElementById: () => { throw new Error('Must not read editable controls'); } },
  });
}
const run = {
  computedAt: '2026-10-21T20:00:00Z', chemicalIdentity: { chemicalName: 'Ammonia', casNumber: '7664-41-7' },
  inputs: { windSpeedMps: 2, releaseHeightM: 0, windDirDeg: 270, tempC: 20 },
  submittedInputs: { weatherSource: 'Manual Weather Entry', weatherObservationTime: '2026-10-21T19:59:00Z', releaseDurationSec: 600 },
  endpoint: { selectedDurationMinutes: 60 },
  thresholdsUsed: [{ kind: 'AEGL', level: 3, valuePpm: 1100, durationMinutes: 60 }],
  isopleths: [{ thresholdKind: 'AEGL', thresholdLevel: 3, maxDownwindM: 1000, maxCrosswindM: 30, rangeTruncated: true }],
};

describe('Threat Zone distinct panels', () => {
  it('replays older saved zone distances and endpoints without inventing missing release inputs', () => {
    const saved = {
      id: 'saved-run', generatedAt: '2026-10-26T21:02:03.682Z',
      chemical: { chemicalName: 'Ammonia (anhydrous)' },
      endpoint: { selectedDuration: 60, value: { aegl1: 30, aegl2: 160, aegl3: 1100 }, units: 'ppm', endpointSource: 'EPA AEGL' },
      release: { duration: null },
      output: { threatZones: [{ thresholdKind: 'AEGL', thresholdLevel: 3, maxDownwindM: 786.5708377066387, maxCrosswindM: 48.845395536838936 }] },
    };
    const restored = runInNewContext(`${declaration('savedPlumeDisplayResult')}; savedPlumeDisplayResult(saved)`, { saved, plumeRecordPayload: (value: unknown) => value });
    expect(restored.id).toBe('saved-run');
    expect(restored.computedAt).toBe(saved.generatedAt);
    expect(restored.isopleths).toEqual(saved.output.threatZones);
    expect(restored.submittedInputs).toEqual({});
    const data = panelData(restored);
    expect(data.rows[0]).toMatchObject({ threshold: '1,100 ppm', duration: '60 min', downwind: '786.571 m' });
    expect(data.details).toContainEqual(['Release Duration', 'Not recorded']);
  });

  it('keeps the submitted duration and weather snapshot omitted by model normalization', async () => {
    const inputs = { releaseDurationSec: 600, weatherSource: 'Manual Weather Entry', weatherObservationTime: '2026-11-17T19:48:25.531Z', lat: 34, lng: -81, windSpeedMps: 2.2352, windDirDeg: 270, tempC: 20 };
    const result = { ...run, inputs: { ...run.inputs }, submittedInputs: undefined, isopleths: [{ polygon: [[1, 1], [2, 2]], maxDownwindM: 365.77762996728325 }] };
    const backend = runInNewContext(`${declaration('runBackendPlume')}; runBackendPlume`, {
      getActiveIncident: () => null, getIncidentChemicalContext: () => ({ chemical: { selectedChemicalId: 10 } }),
      normalizePlumeLocation: () => ({ lat: 34, lon: -81 }),
      fetch: async () => ({ ok: true, json: async () => result }),
    });
    const completed = await backend(inputs);
    inputs.releaseDurationSec = 5940;
    expect(completed.result.submittedInputs.releaseDurationSec).toBe(600);
    expect(panelData(completed.result).details).toContainEqual(['Release Duration', '600 s']);
  });

  it('uses the completed duration in the summary and never substitutes the editable 99-minute control', () => {
    const displayed = new Map();
    const context = {
      result: run, setText: (id: string, value: string) => displayed.set(id, value),
      updatePlumeRightRailZoneResults: vi.fn(), currentThreatZoneGeoJson: null,
      noCurrentDataText: 'Not recorded', degreesToCompass: () => 'E',
      document: { getElementById: () => { throw new Error('Completed summary must not read controls'); } },
    };
    runInNewContext(`${declaration('updatePlumeCommandPanel')}; updatePlumeCommandPanel(result)`, context);
    expect(displayed.get('plume-command-release-duration')).toBe('10 minutes');
    runInNewContext(`${declaration('updatePlumeCommandPanel')}; updatePlumeCommandPanel({...result, submittedInputs: {}})`, context);
    expect(displayed.get('plume-command-release-duration')).toBe('Not recorded');
  });

  it('uses completed-run inputs and distinguishes crosswind half-width, duration, and truncated distance', () => {
    const data = panelData(run);
    expect(data.rows[0]).toMatchObject({ threshold: '1,100 ppm', duration: '60 min', crosswind: '30 m', downwind: '1,000 m (lower bound)' });
    expect(data.details).toContainEqual(['Release Height', '0 m AGL']);
    expect(data.details).toContainEqual(['Weather Source', 'Manual Weather Entry']);
    expect(data.details).toContainEqual(['Release Duration', '600 s']);
  });

  it('does not infer zero facilities when sources are unavailable or pending', () => {
    expect(panelData(run, { status: 'loading' }).rows[0].facilities).toBe('Checking facilities…');
    expect(panelData(run, { status: 'empty', lookupStatus: 'unavailable', zones: { aegl3: { facilities: [] } } }).rows[0].facilities).toBe('Unavailable');
    expect(panelData(run).rows[0].facilities).toBe('Not assessed');
    expect(panelData(run, { status: 'empty', lookupStatus: 'available', zones: { aegl3: { facilities: [] } } }).rows[0].facilities).toBe('0');
  });

  it('clears prior data for a missing model or absent AEGL band', () => {
    const data = panelData(null);
    expect(data.rows.every((row: { downwind: string }) => row.downwind === 'Not modeled')).toBe(true);
    expect(data.details).toContainEqual(['Chemical', 'Not recorded']);
    expect(panelData(run).rows[1].threshold).toBe('Not recorded');
  });

  it('switches panel visibility and keyboard tab stops instead of only highlighting a button', () => {
    const panels = [{ hidden: false }, { hidden: true }, { hidden: true }];
    const tabs = panels.map((_, index) => ({
      classList: { toggle: vi.fn() }, setAttribute: vi.fn(), tabIndex: index === 0 ? 0 : -1,
      getAttribute: () => String(index), focus: vi.fn(), closest: () => ({ querySelectorAll: () => tabs }),
    }));
    runInNewContext(`${declaration('selectThreatZoneTab')}\nselectThreatZoneTab(button, true)`, {
      button: tabs[1], document: { getElementById: (id: string) => panels[Number(id)] },
    });
    expect(panels.map((panel) => panel.hidden)).toEqual([true, false, true]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(tabs[1].focus).toHaveBeenCalledOnce();
  });

  it('exposes facilities immediately and gives each tab its own named panel', () => {
    expect(html).not.toContain('<details class="plume-zone-facilities">');
    expect(html).not.toContain('<details class="plume-zone-details">');
    for (const panel of ['plume-command-zone-summary', 'plume-distance-panel', 'plume-model-panel']) {
      expect(html).toContain(`aria-controls="${panel}"`);
      expect(html).toContain(`id="${panel}"`);
    }
  });
});

describe('Command phase progress', () => {
  it('never marks untouched phases complete and recognizes accomplished phase records', () => {
    type TestNode = { children: TestNode[]; className: string; textContent: string; dataset: object; replaceChildren(): void; append(...children: TestNode[]): void; setAttribute: ReturnType<typeof vi.fn> };
    const node = (): TestNode => ({
      children: [] as TestNode[], className: '', textContent: '', dataset: {},
      replaceChildren() { this.children = []; },
      append(...children: TestNode[]) { this.children.push(...children); },
      setAttribute: vi.fn(),
    });
    const progress = node();
    const definitions = [{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }];
    const context = {
      model: { operationalChecklist: { tasks: [] }, incident: { guidedResponsePhaseState: {} as Record<string, { status: string }> }, tacticalStatus: [] },
      guidedPhaseDefinitions: definitions,
      document: { createElement: node, getElementById: (id: string) => new Map([['ic-guided-progress', progress]]).get(id) },
    };
    const code = ['readGuidedResponsePhaseState', 'guidedPhaseIsAccomplished', 'guidedGoalStatus', 'renderIncidentGuidedResponse'].map(declaration).join('\n');
    runInNewContext(`${code}\nrenderIncidentGuidedResponse(model)`, context);
    expect(progress.children[0].children[0].textContent).toBe('Not Started');
    context.model.incident.guidedResponsePhaseState = { first: { status: 'Accomplished' } };
    runInNewContext(`${code}\nrenderIncidentGuidedResponse(model)`, context);
    expect(progress.children[0].className).toBe('is-pending');
    expect(progress.children[0].children[1].textContent).toBe('Second');
    expect(runInNewContext("guidedGoalStatus({ status: 'Accomplished' })", context)).toBe('Accomplished');
    expect(script).toContain("{ id: 'medical-rehab', label: 'Medical and rehab'");
    expect(script).not.toContain("medical: 'documentation'");
  });
});
