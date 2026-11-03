import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const preferencesScript = readFileSync(new URL('../server/public/preferences.js', import.meta.url), 'utf8');
const appScript = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
function fixture(saved?: string, failWrites = false) {
  const storage = new Map(saved ? [['emergenz.preferences.v1', saved]] : []);
  const listeners = new Map<string, (event: { key: string | null }) => void>();
  const root = { dataset: {} as Record<string, string> };
  const window = { HazMatIQ: {} as Record<string, unknown>, dispatchEvent: vi.fn(),
    addEventListener: (name: string, callback: (event: { key: string | null }) => void) => listeners.set(name, callback) };
  vm.runInNewContext(preferencesScript, { window, document: { documentElement: root },
    localStorage: { getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => { if (failWrites) throw new Error('quota'); storage.set(key, value); } },
    CustomEvent: class { constructor(public type: string, public detail: unknown) {} } });
  const preferences = window.HazMatIQ.preferences as {
    get: (name: string) => unknown; all: () => Record<string, unknown>; save: (input: unknown) => boolean;
  };
  return { preferences, storage, root, window, listeners };
}
describe('device preferences', () => {
  it('restores validated values and ignores unknown keys or wrong types', () => {
    const f = fixture(JSON.stringify({ locationEnabled: false, autoLocation: 'false', weatherRefresh: '1', pdfAction: 'download', token: 'not retained' }));
    expect(f.preferences.get('locationEnabled')).toBe(false);
    expect(f.preferences.get('autoLocation')).toBe(true);
    expect(f.preferences.get('weatherRefresh')).toBe('5');
    expect(f.preferences.get('pdfAction')).toBe('download');
    expect(f.preferences.all()).not.toHaveProperty('token');
  });
  it('persists settings across reloads and sets print attributes', () => {
    const f = fixture();
    expect(f.preferences.save({ ...f.preferences.all(), weatherRefresh: 'manual', printMap: false, printAuthor: true })).toBe(true);
    const next = fixture(f.storage.get('emergenz.preferences.v1'));
    expect(next.preferences.get('weatherRefresh')).toBe('manual');
    expect(next.root.dataset.printMap).toBe('false');
    expect(next.root.dataset.printAuthor).toBe('true');
    expect(f.storage.size).toBe(1);
  });
  it('preserves previous values if storage fails', () => {
    const f = fixture(undefined, true);
    expect(f.preferences.save({ locationEnabled: false })).toBe(false);
    expect(f.preferences.get('locationEnabled')).toBe(true);
    expect(f.window.dispatchEvent).not.toHaveBeenCalled();
  });
  it('handles corrupt storage and propagates another tab’s changes and reset', () => {
    const f = fixture('{broken');
    expect(f.preferences.get('mapView')).toBe('remember');
    f.storage.set('emergenz.preferences.v1', JSON.stringify({ monitorGps: false }));
    f.listeners.get('storage')?.({ key: 'emergenz.preferences.v1' });
    expect(f.preferences.get('monitorGps')).toBe(false);
    f.storage.clear(); f.listeners.get('storage')?.({ key: null });
    expect(f.preferences.get('monitorGps')).toBe(true);
  });
});

function gpsFixture(enabled = true, accuracy = true) {
  const gps = vi.fn(); const settings = { locationEnabled: enabled, highAccuracy: accuracy };
  const context = vm.createContext({ window: { HazMatIQ: { preferences: { get: (name: keyof typeof settings) => settings[name] } } },
    navigator: { geolocation: { getCurrentPosition: gps } },
    normalizePlumeLocation: (point: unknown) => point, getGpsErrorMessage: () => 'Unavailable' });
  const start = appScript.indexOf('let pendingDeviceGpsRequest = null;');
  const end = appScript.indexOf('\nfunction setText(', start);
  vm.runInContext(appScript.slice(start, end), context);
  return { settings, gps, get: () => vm.runInContext('getCurrentGps()', context) as Promise<{ lat: number }> };
}
describe('GPS preference enforcement', () => {
  it('does not request browser GPS when disabled, including cached fixes', async () => {
    const f = gpsFixture();
    f.gps.mockImplementation((success) => success({ coords: { latitude: 33, longitude: -86, accuracy: 8 } }));
    await expect(f.get()).resolves.toMatchObject({ lat: 33 });
    f.settings.locationEnabled = false;
    await expect(f.get()).rejects.toThrow('disabled in Settings');
    expect(f.gps).toHaveBeenCalledTimes(1);
  });
  it('uses the selected accuracy and does not accept a fix after GPS is disabled', async () => {
    const f = gpsFixture(true, false);
    let success: (point: unknown) => void = () => {};
    f.gps.mockImplementation((callback) => { success = callback; });
    const pending = f.get();
    expect(f.gps.mock.calls[0][2].enableHighAccuracy).toBe(false);
    f.settings.locationEnabled = false;
    success({ coords: { latitude: 33, longitude: -86, accuracy: 20 } });
    await expect(pending).rejects.toThrow('disabled in Settings');
  });
});

describe('ICS export action', () => {
  const start = appScript.indexOf('async function openIcsPdf() {');
  const end = appScript.indexOf('\nlet icsPreviewRefreshTimer', start);
  it.each(['view', 'download'])('honors %s without modifying the populated PDF', async (action) => {
    const anchor = { href: '', download: '', click: vi.fn() };
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.fn(() => tab);
    const context = vm.createContext({
      window: { HazMatIQ: { preferences: { get: () => action } }, open },
      openIcsForm: { incidentId: 'incident', formId: 'ics-201', editing: false },
      readIncidents: () => [{ incidentId: 'incident', incidentName: 'Exercise' }],
      refreshIcsPdfPreview: vi.fn(async () => {}), openIcsFormObjectUrl: 'blob:populated-official-form',
      document: { getElementById: () => ({ textContent: '' }), createElement: () => anchor }, console,
    });
    vm.runInContext(appScript.slice(start, end), context);
    await vm.runInContext('openIcsPdf()', context);
    if (action === 'download') {
      expect(open).not.toHaveBeenCalled(); expect(anchor.href).toBe('blob:populated-official-form');
      expect(anchor.download).toBe('ics-201-Exercise.pdf'); expect(anchor.click).toHaveBeenCalledOnce();
    } else { expect(open).toHaveBeenCalledOnce(); expect(tab.location.href).toBe('blob:populated-official-form'); }
  });
});
