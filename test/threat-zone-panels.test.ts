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
    const priorities = node(); const recommendations = node(); const progress = node();
    const definitions = [{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }];
    const context = {
      model: { operationalChecklist: { tasks: [] }, incident: { guidedResponsePhaseState: {} as Record<string, { status: string }> }, tacticalStatus: [] },
      guidedPhaseDefinitions: definitions,
      document: { createElement: node, getElementById: (id: string) => new Map([['ic-guided-priorities', priorities], ['ic-guided-recommendations', recommendations], ['ic-guided-progress', progress]]).get(id) },
    };
    const code = ['guidedPhaseIsAccomplished', 'guidedGoalStatus', 'renderIncidentGuidedResponse'].map(declaration).join('\n');
    runInNewContext(`${code}\nrenderIncidentGuidedResponse(model)`, context);
    expect(priorities.children.map((item) => item.children[0].textContent)).toEqual(['Not Started', 'Not Started']);
    context.model.incident.guidedResponsePhaseState = { first: { status: 'Accomplished' } };
    runInNewContext(`${code}\nrenderIncidentGuidedResponse(model)`, context);
    expect(priorities.children.map((item) => item.className)).toEqual(['is-complete', 'is-pending']);
    expect(script).toContain("medical: 'medical-rehab'");
    expect(script).not.toContain("medical: 'documentation'");
  });
});
