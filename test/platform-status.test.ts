import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const script = readFileSync(new URL('../server/public/platform.js', import.meta.url), 'utf8');
class Element {
  children: Element[] = []; parent: Element | null = null; className = ''; id = ''; textContent = ''; hidden = false;
  dataset: Record<string, string> = {}; handlers: Record<string, () => void> = {};
  append(...elements: Element[]) { for (const e of elements) { if (e.parent) e.parent.children = e.parent.children.filter(c => c !== e); e.parent = this; this.children.push(e); } }
  prepend(e: Element) { e.parent = this; this.children.unshift(e); }
  setAttribute(name: string, value: string) { if (name.startsWith('data-')) this.dataset[name.slice(5)] = value; }
  addEventListener(name: string, callback: () => void) { this.handlers[name] = callback; }
}
interface FixtureOptions { pageBuild?: string | null; deployedBuild?: string; autoUpdate?: 'on' | 'off' }
async function fixture(available = true, waiting = false, options: FixtureOptions = {}) {
  const created: Element[] = [], grid = new Element(), body = new Element();
  const listeners: Record<string, () => void> = {};
  const worker = { postMessage: vi.fn() };
  const registration = { waiting: waiting ? worker : null, addEventListener: vi.fn(), update: vi.fn(async () => {}) };
  const register = vi.fn(async () => registration);
  const navigator = { onLine: true, serviceWorker: { register, addEventListener: vi.fn() } };
  let pending = 0;
  const storage: Record<string, string> = options.autoUpdate ? { 'emergenz.autoUpdate': options.autoUpdate } : {};
  const pageBuild = options.pageBuild === undefined ? 'build-a' : options.pageBuild;
  const deployedBuild = options.deployedBuild ?? pageBuild ?? 'build-a';
  const window = { isSecureContext: true, fetch: vi.fn(async (input: unknown) => {
    if (!available) throw new Error('unreachable');
    if (String(input).includes('/app-version.json')) return { ok: true, json: async () => ({ build: deployedBuild, commit: 'abc1234' }) };
    return { ok: true, json: async () => ({ required: false, user: null }) };
  }), matchMedia: () => ({ matches: false }), addEventListener: (name: string, callback: () => void) => { listeners[name] = callback; },
    localStorage: { getItem: (key: string) => storage[key] ?? null, setItem: (key: string, value: string) => { storage[key] = value; } },
    EMERGENZPendingIncidentCount: () => pending, confirm: () => true, alert: vi.fn() };
  const intervals: Array<() => void> = [], timeouts: Array<() => void> = [];
  const meta = { getAttribute: (name: string) => (name === 'content' ? pageBuild : null) };
  const location = { href: 'https://emergenz.invalid', origin: 'https://emergenz.invalid', reload: vi.fn() };
  const context = vm.createContext({ window, navigator, location,
    setInterval: (callback: () => void) => { intervals.push(callback); return intervals.length; }, clearInterval: (id: number) => { intervals[id - 1] = () => {}; },
    setTimeout: (callback: () => void) => { timeouts.push(callback); return timeouts.length; },
    document: { readyState: 'complete', visibilityState: 'visible', body, addEventListener: () => {}, querySelector: (selector: string) => (selector.includes('emergenz-build') ? (pageBuild === null ? null : meta) : grid), createElement: () => { const e = new Element(); created.push(e); return e; } },
    AbortSignal, Request, Headers, URL, Date, console, Event });
  vm.runInContext(script, context); await new Promise(resolve => setImmediate(resolve));
  const api = vm.runInContext('window.EMERGENZPlatform', context);
  const flush = async () => { for (let i = 0; i < 5; i += 1) await new Promise(resolve => setImmediate(resolve)); };
  // Run the deferred first version check.
  const runVersionCheck = async () => { for (const callback of timeouts.splice(0)) callback(); await flush(); };
  return { api, created, grid, body, navigator, listeners, worker, window, location, intervals, storage, registration, runVersionCheck, flush, setPending: (n: number) => { pending = n; } };
}
const findText = (root: Element, pattern: RegExp): Element | undefined => {
  if (pattern.test(root.textContent)) return root;
  for (const child of root.children) { const found = findText(child, pattern); if (found) return found; }
  return undefined;
};
const findId = (root: Element, id: string): Element | undefined => {
  if (root.id === id) return root;
  for (const child of root.children) { const found = findId(child, id); if (found) return found; }
  return undefined;
};
describe('compact platform status and Settings actions', () => {
  it('keeps install and account detail in Settings and the update action in the top bar', async () => {
    const f = await fixture();
    const bar = f.body.children[0];
    const connection = bar.children.find(e => e.className === 'em-platform-connection');
    expect(connection?.dataset.connection).toBe('connected');
    expect(connection?.children[1].textContent).toBe('Connected');
    expect(bar.children.some(e => /Install App|Pilot/.test(e.textContent))).toBe(false);
    // Update action lives in the always-visible bar (hidden until a new build is waiting).
    const barUpdate = bar.children.find(e => /Update Available/.test(e.textContent));
    expect(barUpdate).toBeDefined(); expect(barUpdate?.hidden).toBe(true);
    const card = f.grid.children[0];
    expect(card.children.some(e => e.textContent.includes('Pilot access'))).toBe(true);
    expect(card.children.some(e => e.children.some(child => child.textContent === 'Install App'))).toBe(true);
  });
  it('does not show a green connection just because the browser has internet', async () => {
    const f = await fixture(false);
    expect(f.api.connectionState()).toEqual({ state: 'disconnected', label: 'Not Connected' });
    f.listeners.online(); expect(f.api.connectionState().state).toBe('checking');
    f.api.status('Saved to server', true); expect(f.api.connectionState().state).toBe('connected');
    f.navigator.onLine = false; f.listeners.offline();
    expect(f.api.connectionState()).toEqual({ state: 'disconnected', label: 'Offline' });
  });
  it('retains unsynced-change warnings and blocks app updates while writes are pending', async () => {
    const f = await fixture(true, true, { deployedBuild: 'build-b' }); f.setPending(2); await f.flush(); f.api.status('Saved on this device');
    const bar = f.body.children[0], warning = bar.children.find(e => e.className === 'em-platform-warning');
    expect(warning?.hidden).toBe(false); expect(warning?.textContent).toBe('2 unsynced changes');
    const update = bar.children.find(e => e.className === 'em-platform-update');
    expect(update?.hidden).toBe(false); update?.handlers.click();
    expect(f.window.alert).toHaveBeenCalled(); expect(f.worker.postMessage).not.toHaveBeenCalled();
    f.setPending(0); f.api.status('Saved to server', true); update?.handlers.click();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_UPDATE' });
    expect(warning?.hidden).toBe(true);
  });
});

describe('app updates', () => {
  it('shows an App Updates panel in Settings with version, check, install and automatic-update controls', async () => {
    const f = await fixture();
    await f.runVersionCheck();
    const card = f.grid.children[0];
    expect(findText(card, /^App Updates$/)).toBeDefined();
    expect(findId(card, 'platform-update-version')?.textContent).toMatch(/This device: build-a · Deployed: build-a · commit abc1234/);
    expect(findId(card, 'platform-update-status')?.textContent).toMatch(/^Up to date · checked/);
    expect(findId(card, 'platform-check-update')?.textContent).toBe('Check for Updates');
    expect((findId(card, 'platform-install-update') as unknown as { disabled: boolean }).disabled).toBe(true);
    expect((findId(card, 'platform-auto-update') as unknown as { checked: boolean }).checked).toBe(true);
  });
  it('detects a new deploy and updates automatically after a 30-second notice', async () => {
    const f = await fixture(true, false, { deployedBuild: 'build-b' });
    await f.runVersionCheck();
    const bar = f.body.children[0];
    const update = bar.children.find(e => e.className === 'em-platform-update')!;
    expect(update.hidden).toBe(false);
    expect(update.textContent).toBe('Updating in 30s · Update Now');
    const postpone = bar.children.find(e => e.className === 'em-platform-postpone')!;
    expect(postpone.hidden).toBe(false);
    const tick = f.intervals.at(-1)!;
    for (let i = 0; i < 29; i += 1) tick();
    expect(f.location.reload).not.toHaveBeenCalled();
    tick();
    expect(f.location.reload).toHaveBeenCalledTimes(1);
  });
  it('lets the user postpone the automatic update', async () => {
    const f = await fixture(true, false, { deployedBuild: 'build-b' });
    await f.runVersionCheck();
    const bar = f.body.children[0];
    bar.children.find(e => e.className === 'em-platform-postpone')!.handlers.click();
    const update = bar.children.find(e => e.className === 'em-platform-update')!;
    expect(update.textContent).toBe('Update Available · Tap to Install');
    expect(update.hidden).toBe(false);
    for (const tick of f.intervals) tick();
    expect(f.location.reload).not.toHaveBeenCalled();
  });
  it('only offers the update when automatic updates are off, and Install Update applies it', async () => {
    const f = await fixture(true, false, { deployedBuild: 'build-b', autoUpdate: 'off' });
    await f.runVersionCheck();
    const card = f.grid.children[0];
    const update = f.body.children[0].children.find(e => e.className === 'em-platform-update')!;
    expect(update.textContent).toBe('Update Available · Tap to Install');
    expect(findId(card, 'platform-update-status')?.textContent).toMatch(/new version is available/);
    const install = findId(card, 'platform-install-update')! as unknown as Element & { disabled: boolean };
    expect(install.disabled).toBe(false);
    install.handlers.click();
    expect(f.location.reload).toHaveBeenCalledTimes(1);
  });
  it('never auto-updates while incident changes are unsynced', async () => {
    const f = await fixture(true, false, { deployedBuild: 'build-b' });
    f.setPending(1);
    await f.runVersionCheck();
    const update = f.body.children[0].children.find(e => e.className === 'em-platform-update')!;
    expect(update.hidden).toBe(false);
    expect(update.textContent).toBe('Update Available · Tap to Install');
    for (const tick of f.intervals) tick();
    expect(f.location.reload).not.toHaveBeenCalled();
    expect(findId(f.grid.children[0], 'platform-update-status')?.textContent).toMatch(/Sync or resolve 1 pending change/);
  });
  it('silently activates a waiting worker when the page already runs the deployed build', async () => {
    const f = await fixture(true, true);
    await f.flush();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_UPDATE' });
    const update = f.body.children[0].children.find(e => e.className === 'em-platform-update')!;
    expect(update.hidden).toBe(true);
    expect(f.location.reload).not.toHaveBeenCalled();
  });
});
