import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler, Context } from 'hono';

const derive = promisify(scrypt);
const cookieName = 'emergenz_session';
const sessionMs = 8 * 60 * 60 * 1000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const required = () => process.env.EMERGENZ_AUTH_MODE === 'required';
const failures = new Map<string, { count: number; until: number }>();

function database() {
  const filename = process.env.SQLITE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../local.db');
  const db = new Database(filename);
  db.pragma('busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS app_users (
    username TEXT PRIMARY KEY, display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);`);
  return db;
}

export async function provisionUser(username: string, displayName: string, password: string) {
  username = username.trim().toLowerCase();
  if (!/^[a-z0-9._@+-]{3,120}$/.test(username) || !displayName.trim() || displayName.length > 120 || password.length < 14 || password.length > 256) {
    throw new Error('Use a valid username, display name, and a password of 14–256 characters.');
  }
  const salt = randomBytes(32).toString('hex');
  const key = await derive(password, salt, 64) as Buffer;
  const db = database();
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO app_users(username,display_name,password_hash) VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name,password_hash=excluded.password_hash,enabled=1')
        .run(username, displayName.trim(), `${salt}:${key.toString('hex')}`);
      db.prepare('DELETE FROM app_sessions WHERE username=?').run(username);
    })();
  } finally { db.close(); }
}

function session(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = database();
  try {
    db.prepare('DELETE FROM app_sessions WHERE expires_at < ?').run(Date.now());
    return db.prepare(`SELECT u.username, u.display_name AS displayName, s.csrf, s.expires_at AS expiresAt
      FROM app_sessions s JOIN app_users u ON u.username=s.username
      WHERE s.token_hash=? AND u.enabled=1 AND s.expires_at>?`).get(hash(token), Date.now()) as
      { username: string; displayName: string; csrf: string; expiresAt: number } | undefined;
  } finally { db.close(); }
}

export const accessGuard: MiddlewareHandler = async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!required() || c.req.path.startsWith('/api/auth/')) return next();
  const account = session(getCookie(c, cookieName));
  if (!account) return c.json({ error: 'Sign in required', code: 'SIGN_IN_REQUIRED' }, 401);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('X-EMERGENZ-CSRF') !== account.csrf) {
    return c.json({ error: 'Session verification required' }, 403);
  }
  await next();
};

export const accountForRequest = (c: Context) => required() ? session(getCookie(c, cookieName)) : null;

export const accessRoutes = new Hono();
accessRoutes.use('*', bodyLimit({ maxSize: 8192 }));
accessRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const origin = c.req.header('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'Same-origin request required' }, 403);
    } catch { return c.json({ error: 'Invalid origin' }, 403); }
  }
  await next();
});
accessRoutes.get('/session', (c) => {
  const account = required() ? session(getCookie(c, cookieName)) : null;
  return c.json({ required: required(), user: account || null });
});
accessRoutes.post('/login', async (c) => {
  if (!required()) return c.json({ error: 'Account access is not enabled on this deployment' }, 409);
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (username.length > 120 || password.length > 256) return c.json({ error: 'Invalid credentials' }, 400);
  const now = Date.now();
  for (const [key, failure] of failures) if (failure.until < now) failures.delete(key);
  if (failures.size > 5000) return c.json({ error: 'Sign-in temporarily unavailable' }, 429);
  const attempt = failures.get(username);
  if (attempt && attempt.until > now && attempt.count >= 5) return c.json({ error: 'Too many attempts; try again in 15 minutes' }, 429);
  failures.set(username, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60 * 1000 });
  const db = database();
  try {
    const row = db.prepare('SELECT password_hash FROM app_users WHERE username=? AND enabled=1').get(username) as { password_hash: string } | undefined;
    // Derive even for unknown users to avoid a fast username-enumeration path.
    const [salt, expected] = row?.password_hash.split(':') || ['0'.repeat(64), '0'.repeat(128)];
    const actual = await derive(password, salt, 64) as Buffer;
    if (!row || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) return c.json({ error: 'Invalid credentials' }, 401);
    failures.delete(username);
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO app_sessions VALUES(?,?,?,?)').run(hash(token), username, randomBytes(32).toString('hex'), now + sessionMs);
    setCookie(c, cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' || new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/api', maxAge: sessionMs / 1000 });
    return c.json({ user: session(token) });
  } finally { db.close(); }
});
accessRoutes.post('/logout', (c) => {
  const token = getCookie(c, cookieName);
  const account = session(token);
  if (account && c.req.header('X-EMERGENZ-CSRF') !== account.csrf) return c.json({ error: 'Session verification required' }, 403);
  const db = database();
  try { if (token) db.prepare('DELETE FROM app_sessions WHERE token_hash=?').run(hash(token)); }
  finally { db.close(); }
  deleteCookie(c, cookieName, { path: '/api' });
  return c.json({ signedOut: true });
});
