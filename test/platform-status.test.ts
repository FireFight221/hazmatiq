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
async function fixture(available = true, waiting = false) {
  const created: Element[] = [], grid = new Element(), body = new Element();
  const listeners: Record<string, () => void> = {};
  const worker = { postMessage: vi.fn() };
  const register = vi.fn(async () => ({ waiting: waiting ? worker : null, addEventListener: vi.fn() }));
  const navigator = { onLine: true, serviceWorker: { register, addEventListener: vi.fn() } };
  let pending = 0;
  const window = { isSecureContext: true, fetch: vi.fn(async () => {
    if (!available) throw new Error('unreachable');
    return { ok: true, json: async () => ({ required: false, user: null }) };
  }), matchMedia: () => ({ matches: false }), addEventListener: (name: string, callback: () => void) => { listeners[name] = callback; },
    EMERGENZPendingIncidentCount: () => pending, confirm: () => true, alert: vi.fn() };
  const context = vm.createContext({ window, navigator, location: { href: 'https://emergenz.invalid', origin: 'https://emergenz.invalid' },
    document: { readyState: 'complete', body, querySelector: () => grid, createElement: () => { const e = new Element(); created.push(e); return e; } },
    AbortSignal, Request, Headers, URL, Date, console, Event });
  vm.runInContext(script, context); await new Promise(resolve => setImmediate(resolve));
  const api = vm.runInContext('window.EMERGENZPlatform', context);
  return { api, created, grid, body, navigator, listeners, worker, window, setPending: (n: number) => { pending = n; } };
}
describe('compact platform status and Settings actions', () => {
  it('keeps install, account detail, and update actions in Settings', async () => {
    const f = await fixture();
    const bar = f.body.children[0];
    const connection = bar.children.find(e => e.className === 'em-platform-connection');
    expect(connection?.dataset.connection).toBe('connected');
    expect(connection?.children[1].textContent).toBe('Connected');
    expect(bar.children.some(e => /Install App|Update Available|Pilot/.test(e.textContent))).toBe(false);
    const card = f.grid.children[0];
    expect(card.children.some(e => e.textContent.includes('Pilot access'))).toBe(true);
    expect(card.children.at(-1)?.children.map(e => e.textContent)).toContain('Install App');
    expect(card.children.at(-1)?.children.map(e => e.textContent)).toContain('Update Available');
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
    const f = await fixture(true, true); f.setPending(2); f.api.status('Saved on this device');
    const bar = f.body.children[0], warning = bar.children.find(e => e.className === 'em-platform-warning');
    expect(warning?.hidden).toBe(false); expect(warning?.textContent).toBe('2 unsynced changes');
    const update = f.grid.children[0].children.at(-1)?.children.find(e => e.textContent === 'Update Available');
    expect(update?.hidden).toBe(false); update?.handlers.click();
    expect(f.window.alert).toHaveBeenCalled(); expect(f.worker.postMessage).not.toHaveBeenCalled();
    f.setPending(0); f.api.status('Saved to server', true); update?.handlers.click();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: 'ACTIVATE_UPDATE' });
    expect(warning?.hidden).toBe(true);
  });
});
