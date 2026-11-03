import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Hono } from 'hono';
import { provisionUser } from '../src/access.js';
import { offlineWorker } from '../src/pwa.js';

let app: Hono;
let cookie = '';
let csrf = '';
const credentials = { username: 'pilot-test', password: 'test-only-password-not-a-real-account' };
beforeAll(async () => {
  process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'emergenz-platform-')), 'test.db');
  process.env.EMERGENZ_AUTH_MODE = 'required';
  execFileSync(process.execPath, ['--import', 'tsx', 'src/init-sqlite.ts'], { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'pipe' });
  await provisionUser(credentials.username, 'Training Commander', credentials.password);
  app = (await import('../src/app.js')).default;
}, 30000);
afterAll(() => { delete process.env.EMERGENZ_AUTH_MODE; });
const post = (body: unknown, token = csrf) => app.request('/api/incidents', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-EMERGENZ-CSRF': token }, body: JSON.stringify(body),
});

describe('single-agency account and shared incident safeguards', () => {
  it('protects API data and rejects invalid credentials', async () => {
    expect((await app.request('/api/incidents')).status).toBe(401);
    const response = await app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...credentials, password: 'incorrect' }) });
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('issues an HttpOnly session, supplies identity, and requires CSRF for changes', async () => {
    const response = await app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('Set-Cookie')).toMatch(/SameSite=Strict/i);
    cookie = response.headers.get('Set-Cookie')!.split(';')[0];
    const data = await response.json() as { user: { csrf: string; displayName: string; password_hash?: string } }; csrf = data.user.csrf;
    expect(data.user.displayName).toBe('Training Commander');
    expect(data.user.password_hash).toBeUndefined();
    expect((await post({ incidents: [] }, 'incorrect')).status).toBe(403);
    const foreign = await app.request('/api/auth/login', { method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    expect(foreign.status).toBe(403);
  });
  it('preserves saved records and rejects concurrent stale writes instead of overwriting', async () => {
    const original = { incidentId: 'shared-pilot', incidentName: 'Training', status: 'Active', assignments: [{ id: 'team-1', name: 'Recon' }] };
    const created = await post({ incidents: [original] });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ accepted: [{ incidentId: original.incidentId, revision: 1 }] });
    const updated = await post({ incidents: [{ ...original, incidentName: 'Commander edit', _syncRevision: 1 }] });
    expect(updated.status).toBe(200);
    const stale = await post({ incidents: [{ ...original, incidentName: 'Stale researcher edit', _syncRevision: 1 }] });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ conflicts: [{ incidentId: original.incidentId, server: { incidentName: 'Commander edit', _syncRevision: 2 } }] });
    const records = await (await app.request('/api/incidents', { headers: { Cookie: cookie } })).json() as { incidents: Array<Record<string, unknown>> };
    expect(records.incidents[0]).toMatchObject({ incidentName: 'Commander edit', assignments: original.assignments, preparedBy: 'Training Commander', lastSavedBy: { username: credentials.username } });
  });
  it('acknowledges a retried write once when the original response was lost', async () => {
    const incident = { incidentId: 'retry-fixture', status: 'Active', incidentName: 'Retry test', _syncMutation: 'unique-test-mutation' };
    expect((await post({ incidents: [incident] })).status).toBe(200);
    const retried = await post({ incidents: [incident] });
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ accepted: [{ incidentId: incident.incidentId, revision: 1 }] });
    const forgedRetry = await post({ incidents: [{ ...incident, incidentName: 'Different content' }] });
    expect(forgedRetry.status).toBe(409);
  });
  it('does not reopen completed incidents through sync', async () => {
    expect((await post({ incidents: [{ incidentId: 'shared-pilot', status: 'Completed', _syncRevision: 2 }] })).status).toBe(200);
    expect((await post({ incidents: [{ incidentId: 'shared-pilot', status: 'Active', _syncRevision: 3 }] })).status).toBe(409);
  });
  it('revokes sessions on sign-out', async () => {
    const result = await app.request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie, 'X-EMERGENZ-CSRF': csrf } });
    expect(result.status).toBe(200);
    expect((await app.request('/api/incidents', { headers: { Cookie: cookie } })).status).toBe(401);
  });
  it('serves an install manifest and content-versioned offline worker without caching APIs', async () => {
    const manifest = await app.request('/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(await manifest.json()).toMatchObject({ name: 'EMERGENZ', display: 'standalone' });
    const source = await offlineWorker(path.resolve(__dirname, '../public'));
    expect(source).toMatch(/const CACHE = "emergenz-shell-[a-f0-9]{16}"/);
    expect(source).not.toContain('__EMERGENZ_');
    expect(source).toContain("url.pathname.startsWith('/api/')");
    const worker = await app.request('/service-worker.js');
    expect(worker.status).toBe(200);
    expect(worker.headers.get('Content-Type')).toContain('javascript');
    expect(worker.headers.get('Cache-Control')).toBe('no-cache');
  });
});
