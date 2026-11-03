import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Version the shell from the files actually served; no frontend build step.
export async function offlineWorker(publicDirectory: string) {
  const html = await readFile(path.join(publicDirectory, 'index.html'), 'utf8');
  const links = [...html.matchAll(/(?:src|href)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
  const core = [...new Set(['/', '/manifest.webmanifest', '/assets/app-icon-192.png', '/assets/app-icon-512.png', ...links.map((link) => {
    const url = new URL(link, 'https://shell.invalid/');
    return url.origin === 'https://shell.invalid' ? `${url.pathname}${url.search}` : '';
  }).filter(Boolean)])];
  const template = await readFile(path.join(publicDirectory, 'offline-worker.js'), 'utf8');
  const hash = createHash('sha256').update(template);
  for (const url of core) {
    const pathname = new URL(url, 'https://shell.invalid').pathname;
    hash.update(url).update(await readFile(path.join(publicDirectory, pathname === '/' ? 'index.html' : pathname.slice(1))));
  }
  return template.replace('__EMERGENZ_CACHE__', JSON.stringify(`emergenz-shell-${hash.digest('hex').slice(0,16)}`))
    .replace('__EMERGENZ_CORE__', JSON.stringify(core));
}
