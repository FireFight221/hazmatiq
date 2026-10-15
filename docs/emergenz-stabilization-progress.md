# EMERGENZ stabilization progress

Updated: 2026-10-15

## Recovery state

- Recovery branch: `recovery-emergenz-wip-20261015-2256`
- Recovery checkpoint: `0f54c6cb1b3e786adc7642d195fb1e13ba97b46e`
- Cleanup branch: `cleanup-emergenz-from-checkpoint-20261015-2256`
- No merge or rebase was in progress when the checkpoint was created.
- The checkpoint includes the reviewed application changes, tests, CBRNE profile source, and new monitoring/map assets.
- Deliberately excluded from the checkpoint: `server/.env`, `server/local.db`, `data/ChemicalCompanionDB.db`, and `node_modules`.

## Audit notes

- The live Plume page has one active map and one active location/action toolbar. The second map block was obsolete markup inside an HTML comment.
- Plume geometry had accumulated multiple conflicting layout contracts in `plume-overrides.css`; `plume-layout-correction.css` is now the intended geometry owner.
- GPS normalization accepts latitude/longitude in the canonical order and records a timestamp only after a successful browser geolocation callback. Manual and saved incident locations remain separate fallbacks.
- Weather and radar providers expose explicit loading/unavailable states; provider availability still requires runtime verification.
- Browser-control binaries are not installed in this Codespace, so screenshot verification is currently unavailable. Static checks, focused tests, server/API checks, and source audits are being used until browser infrastructure is available.

## Staged work

- [x] Stage 1 — shared shell, navigation, headers, and authoritative layout ownership
- [x] Stage 2 — duplicate/dead markup, IDs, handlers, initialization, and stale recovery code
- [ ] Stage 3 — page-specific, weather/GPS, threat-zone, and profile rendering repairs
- [ ] Stage 4 — proven unused assets/files/dependencies

## Validation log

- `npm run typecheck`: passed before cleanup work.
- `npm run lint`: passed with 9 existing `no-explicit-any` warnings in `test/guided-response-decision-builder.test.ts`.
- Full Vitest baseline: 52/54 files and 549/569 tests passed; 20 existing failures remain in `test/plume-map-views.test.ts` and `test/notification-center.test.ts` and must be resolved or documented during cleanup.
- Focused guided-response/Incident Command tests: 60 tests passed before cleanup work.
- Stage 1 validation: `npm run typecheck` passed; `npm run lint` passed with the same 9 warnings; focused UI run passed 84 tests and retained 15 known static-contract failures in `test/plume-map-views.test.ts`.
- Stage 1 change: removed obsolete Plume hero-header rules from the shared shell stylesheet; the active Plume page remains toolbar-first with the canonical two-track workspace geometry.
- Stage 2 validation: active DOM ID audit reports no duplicate IDs; JavaScript syntax checks pass; Guided Response, Incident Command, and hazard-flow tests pass (49/49).
- Stage 2 change: removed the obsolete commented pre-rebase Plume map block and removed the recovery-only script cache label. The non-visual `COMMAND FLOW` marker remains intentionally for existing compatibility checks.
- Stage 3 validation: `npm run typecheck` passed; `npm run lint` passed with the same 9 warnings; server/API route tests passed, and the focused runtime suite passed 93 tests. The existing `test/plume-map-views.test.ts` static-contract subset still reports the same 15 pre-existing failures; no new failure category was introduced by this stage.
- Stage 3 change: added the same-origin `POST /api/threat-zones/census` proxy and switched the Threat Zone Census lookup to it. The valid Pelham-area test geometry returned `10,557` population context, `4,092` housing units, and `93` intersecting 2020 Census blocks. A matching facility lookup returned status `available`, two facilities (one school and one fire station), and available source statuses.
- Stage 3 change: radar provider activation now completes with an explicit `Unavailable` state if provider configuration/metadata fails instead of leaving the Weather page in loading. Obsolete Plume geometry blocks were removed from `plume-overrides.css`; toolbar/workspace/map geometry remains owned by `plume-layout-correction.css`.
- Runtime weather result: `/api/weather/alerts` returned HTTP 200 with a connected empty alert set; `/api/weather/wind` returned HTTP 200 with an Open-Meteo grid. `/api/weather/current` returned NWS KBHM observation data during the final probe, while Open-Meteo intermittently timed out server-side; a direct Open-Meteo request succeeded, so forecast availability remains an external/provider-latency issue to monitor.
- GPS verification: source audit confirms `GPS LIVE` is only set after a successful browser geolocation callback with `acquiredAt`; failed permission/timeout paths show `UNAVAILABLE` and retain a saved map view. Browser permission could not be exercised because no browser-control runtime is installed in this Codespace.
