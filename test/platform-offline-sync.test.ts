import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function trackerFixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) };
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../server/public/incident-sync.js', import.meta.url), 'utf8'), context);
  const create = () => context.EMERGENZSync.createTracker(storage);
  return { create };
}
describe('durable incident outbox', () => {
  it('restores pending writes after a page restart', () => {
    const { create } = trackerFixture(); const first = create();
    first.observe('incident', 4); first.enqueue('incident');
    const restored = create();
    expect(restored.count()).toBe(1);
    expect(restored.batch()[0]).toMatchObject({ id: 'incident', base: 4 });
  });
  it('does not clear a newer edit while acknowledging an older in-flight write', () => {
    const { create } = trackerFixture(); const tracker = create();
    tracker.observe('incident', 1); tracker.enqueue('incident'); const sent = tracker.batch()[0];
    tracker.enqueue('incident'); tracker.acknowledge('incident', sent.mutation, 2);
    expect(tracker.count()).toBe(1); expect(tracker.batch()[0].base).toBe(2);
  });
  it('keeps the original base when a newer server revision is observed', () => {
    const { create } = trackerFixture(); const tracker = create();
    tracker.observe('incident', 1); tracker.enqueue('incident'); tracker.observe('incident', 2);
    expect(tracker.batch()[0].base).toBe(1);
    tracker.resolve('incident', 2, true);
    expect(tracker.batch()[0].base).toBe(2);
    tracker.resolve('incident', 3, false); expect(tracker.count()).toBe(0);
  });
  it('requires conflict review for a legacy edit with an unknown server base', () => {
    const { create } = trackerFixture(); const tracker = create();
    tracker.observe('incident', 8); tracker.enqueue('incident', true);
    expect(tracker.batch()[0].base).toBeNull();
  });
});

describe('offline shell isolation', () => {
  function workerFixture() {
    const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
    const deleted: string[] = [];
    let activated = false;
    const cached = { marker: 'cached application shell' };
    const context = vm.createContext({ URL,
      self: { location: { origin: 'https://emergenz.invalid' }, clients: { claim: () => Promise.resolve() },
        addEventListener: (name: string, callback: typeof handlers[string]) => { handlers[name] = callback; },
        skipWaiting: () => { activated = true; } },
      caches: { open: async () => ({ match: async () => cached }),
        keys: async () => ['emergenz-shell-old', 'emergenz-shell-test', 'unrelated-cache'],
        delete: async (name: string) => { deleted.push(name); } },
      fetch: () => { throw new Error('Network unavailable'); },
    });
    const source = readFileSync(new URL('../server/public/offline-worker.js', import.meta.url), 'utf8')
      .replace('__EMERGENZ_CACHE__', '"emergenz-shell-test"').replace('__EMERGENZ_CORE__', '["/","/platform.js?v=1"]');
    vm.runInContext(source, context);
    return { handlers, deleted, cached, activated: () => activated };
  }
  it('opens the cached shell without a network connection', async () => {
    const fixture = workerFixture(); let result: unknown;
    fixture.handlers.fetch({ request: { url: 'https://emergenz.invalid/', method: 'GET', mode: 'navigate' }, respondWith: (value: unknown) => { result = value; } });
    expect(await result).toEqual(fixture.cached);
  });
  it('never intercepts APIs, map-provider requests, or writes', () => {
    const fixture = workerFixture();
    for (const request of [
      { url: 'https://emergenz.invalid/api/incidents', method: 'GET' },
      { url: 'https://emergenz.invalid/api/auth/session', method: 'GET' },
      { url: 'https://emergenz.invalid/api/weather', method: 'GET' },
      { url: 'https://tiles.example.invalid/tile.png', method: 'GET' },
      { url: 'https://emergenz.invalid/', method: 'POST' },
    ]) {
      let intercepted = false;
      fixture.handlers.fetch({ request, respondWith: () => { intercepted = true; } });
      expect(intercepted).toBe(false);
    }
  });
  it('activates updates only on request and cleans only its own old caches', async () => {
    const fixture = workerFixture(); expect(fixture.activated()).toBe(false);
    fixture.handlers.message({ data: { type: 'ACTIVATE_UPDATE' } });
    expect(fixture.activated()).toBe(true);
    let done: unknown;
    fixture.handlers.activate({ waitUntil: (value: unknown) => { done = value; } });
    await done;
    expect(fixture.deleted).toEqual(['emergenz-shell-old']);
  });
});
