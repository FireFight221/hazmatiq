# EMERGENZ web application and PWA foundation

This change extends the existing Hono/plain-JavaScript application. It does not
replace the UI, create a second incident database, or change Render configuration.

## What works

- Install manifest, local icons, and an Install App control. Browser/platform
  installation support varies; iPhone/iPad users can use Add to Home Screen.
- A versioned, atomic application-shell cache. A changed shell waits for an explicit
  Update action; updates are blocked while incident writes are pending.
- Existing device-local incident data remains usable during a disconnection.
  An incident outbox persists across reloads and retries on reconnect and while
  the foreground app is open. Saving locally and saving to the server are displayed
  separately. Browser storage failure is not a successful local save.
- Shared-server revision checks prevent stale clients from silently overwriting
  other users. Conflicts retain device edits and require an explicit choice. This
  is record-level conflict resolution, not simultaneous field-by-field collaboration.
- The foreground app polls the shared incident store every 15 seconds. Both
  devices must use the same deployment and select the same incident. Existing
  incident-attached weather briefs/assignments travel with that incident record.
- Optional single-agency user accounts: salted scrypt password hashes, expiring
  hashed server sessions, HttpOnly/SameSite cookies, CSRF checks, and a sign-in
  attempt limit. API responses are not cached. Report author defaults use the
  authenticated profile; manual report corrections are preserved. A recorded
  author is not a cryptographic signature or an attestation that tasks occurred.

## Enable agency sign-in

Default mode remains `pilot` so an existing deployment is not unexpectedly locked
out. Pilot mode is explicitly displayed and is not protected account access.
Before using private operational data, provision accounts and set
`EMERGENZ_AUTH_MODE=required`. Unknown mode values stop server startup.

Run from the server directory against the intended persistent `SQLITE_PATH`.
Use the shell's silent password prompt; never put a password in a command argument,
source file, deployment log, or chat:

```bash
read -r -s -p 'New password (14+ characters): ' EMERGENZ_NEW_PASSWORD
printf '\n'
printf '%s' "$EMERGENZ_NEW_PASSWORD" | npm run account:create -- wade 'Wade Simmons'
unset EMERGENZ_NEW_PASSWORD
```

The command creates/updates an account and revokes that account's old sessions.
The session lifetime is eight hours. Use HTTPS in production; production cookies
are Secure. Account credentials and sessions are server-only. Use the same
durable SQLite volume as incident records and back it up using SQLite's backup
facility or a consistent volume snapshot. A code push does not transfer databases.

This is one trusted agency per deployment: all enabled accounts share that agency's
incident records. Multi-agency tenancy, granular roles, SSO/MFA, account recovery,
and self-service administration are not implemented by this baseline. Do not
represent it as a multi-tenant commercial identity system.

## Offline boundaries

Offline operation is for managed, trusted devices. Existing incident storage is
not encrypted at rest and is retained on the device after sign-out. Online API
authentication does not constitute a secure offline identity/unlock mechanism.
Devices that cannot meet those requirements should not retain sensitive records.

The service worker caches only the application shell. It never intercepts API
requests, private imports, third-party map tiles, or weather/wildfire feeds.
Uncached chemical lookups, PDF generation, remote maps, and new live observations
need a server connection. Previously saved incident/profile information is not
newly verified because the app opens offline. Existing observation timestamps and
freshness restrictions continue to apply. There are no offline map packs in this
release, no live personnel tracking, and no guaranteed background delivery after
the operating system closes the app.

Do not clear site data with unsynced work present. Storage quota/eviction and
shared-device policies need device acceptance testing. A native app or managed
local gateway may later be needed for specific monitor hardware or field policies.

## Review before preview promotion

Verify installation and offline reload on target iPad/Android/Windows browsers,
two-device sync/conflict behavior, session expiry, and report/PDF author fields.
Verify the deployed SQLite path is persistent. Activate sign-in only after real
agency accounts exist. This implementation does not authorize changing Render
settings, importing private facility data, or promoting development automatically.
