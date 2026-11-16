import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const fn = (name: string) => { const start = script.indexOf(`function ${name}(`); const end = script.indexOf('\n}', start) + 2; return script.slice(start, end); };

describe('Deferred 3D and saved report images', () => {
  it.each(['plume3d', 'tactical'])('restores %s sessions to Satellite without starting the 3D renderer', (mode) => {
    expect(runInNewContext(`${fn('readStoredPlumeMapView')}\nreadStoredPlumeMapView()`, { window: { localStorage: { getItem: () => mode } }, plumeMapViewStorageKey: 'view', plumeMapViews: { satellite: {}, street: {}, plume3d: {} } })).toBe('satellite');
    const guard = script.slice(script.indexOf('async function setPlumeMapView('), script.indexOf('async function setPlumeMapView(') + 190);
    expect(guard).toContain("if (viewName === 'plume3d' || viewName === 'tactical') viewName = 'satellite'");
  });
  it('rehydrates a saved map for server sync after local storage compacts it to a reference', async () => {
    let payload: { incidents: Array<Record<string, unknown>> } | undefined;
    const incidentOutbox = {
      batch: vi.fn(() => [{ id: 'trial', base: 0, mutation: 1 }]),
      count: vi.fn(() => 1),
      acknowledge: vi.fn(),
    };
    const context = {
      window: { indexedDB: null }, incidentMapSnapshotCache: new Map(), incidentSyncBusy: false, incidentLocalSaveFailed: false,
      navigator: { onLine: true }, incidentOutbox, incidentConflicts: [],
      readIncidents: () => [{ incidentId: 'trial', plumeMapImageRef: 'trial' }],
      isIncidentDeletionMarked: () => false,
      fetch: async (_url: string, request: { body: string }) => { payload = JSON.parse(request.body); return { ok: true, json: async () => ({ accepted: [{ incidentId: 'trial', revision: 1 }], conflicts: [] }) }; },
      AbortSignal: { timeout: vi.fn(() => undefined) },
      showIncidentSyncConflicts: vi.fn(), showIncidentSyncStatus: vi.fn(),
      console,
    };
    const syncStart = script.indexOf('async function syncIncidentsToBackend(');
    const sync = script.slice(syncStart, script.indexOf('function incidentModifiedAt(', syncStart));
    await runInNewContext(`${fn('persistIncidentMapSnapshot')}\n${fn('readIncidentMapSnapshot')}\n${sync}\npersistIncidentMapSnapshot('trial', 'data:image/jpeg;base64,training');\nsyncIncidentsToBackend();`, context);
    expect(payload?.incidents[0].plumeMapImage).toBe('data:image/jpeg;base64,training');
    expect(incidentOutbox.acknowledge).toHaveBeenCalledWith('trial', 1, 1);
  });
});
