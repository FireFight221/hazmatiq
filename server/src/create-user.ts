import './db.js';
import { readFileSync } from 'node:fs';
import { provisionUser } from './access.js';

const [username, displayName] = process.argv.slice(2);
if (!username || !displayName || process.stdin.isTTY) {
  console.error('Usage: pipe a password on stdin to npm run account:create -- username "Display Name"');
  process.exitCode = 1;
} else {
  try {
    await provisionUser(username, displayName, readFileSync(0, 'utf8').replace(/\r?\n$/, ''));
    console.log('Account saved. Existing sessions for this account were revoked.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Account could not be saved.');
    process.exitCode = 1;
  }
}
