import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

interface ShellManifest {
  build: string;
  core: string[];
  template: string;
}

async function shellManifest(publicDirectory: string): Promise<ShellManifest> {
  const html = await readFile(path.join(publicDirectory, 'index.html'), 'utf8');
  const links = [...html.matchAll(/(?:src|href)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
  // These shared visuals must travel with the cached HTML/CSS. Otherwise an
  // installed shell can load successfully offline with blank branding/cards.
  const sharedVisuals = [
    '/assets/emergenz-compass-tight.png?v=1',
    '/assets/emergenz-wordmark-tight.png?v=1',
    '/assets/page-nav-icons.svg',
    '/assets/home-action-incident-v2.png?v=1',
    '/assets/home-action-planning-v2.png?v=3',
    '/assets/home-action-reports-v2.png?v=3',
  ];
  const core = [...new Set(['/', '/manifest.webmanifest', '/assets/emergenz-app-32-v2.png', '/assets/emergenz-app-192-v2.png', '/assets/emergenz-app-512-v2.png', '/assets/emergenz-app-maskable-512-v2.png', ...sharedVisuals, ...links.map((link) => {
    const url = new URL(link, 'https://shell.invalid/');
    return url.origin === 'https://shell.invalid' ? `${url.pathname}${url.search}` : '';
  }).filter(Boolean)])];
  const template = await readFile(path.join(publicDirectory, 'offline-worker.js'), 'utf8');
  const hash = createHash('sha256').update(template);
  for (const url of core) {
    const pathname = new URL(url, 'https://shell.invalid').pathname;
    hash.update(url).update(await readFile(path.join(publicDirectory, pathname === '/' ? 'index.html' : pathname.slice(1))));
  }
  return { build: hash.digest('hex').slice(0, 16), core, template };
}

// Version the shell from the files actually served; no frontend build step.
export async function offlineWorker(publicDirectory: string) {
  const { build, core, template } = await shellManifest(publicDirectory);
  return template.replace('__EMERGENZ_CACHE__', JSON.stringify(`emergenz-shell-${build}`))
    .replace('__EMERGENZ_CORE__', JSON.stringify(core));
}

const serverStartedAt = new Date().toISOString();

/**
 * The deployed app build. `build` is the same content hash that names the
 * offline cache, so it changes exactly when any served shell file changes.
 */
export async function appVersion(publicDirectory: string) {
  const { build } = await shellManifest(publicDirectory);
  const commit = (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').trim().slice(0, 7) || null;
  return { build, commit, serverStartedAt };
}

/** Stamp the served page with its build so an open tab can tell when it is stale. */
export function stampBuild(html: string, build: string) {
  const meta = `<meta name="emergenz-build" content="${build}" />`;
  if (html.includes('name="emergenz-build"')) return html;
  // Insert at the top of <head> so it exists before platform.js runs.
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (tag) => `${tag}\n    ${meta}`) : `${meta}\n${html}`;
}
