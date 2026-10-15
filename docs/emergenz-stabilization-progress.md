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
- [ ] Stage 2 — duplicate/dead markup, IDs, handlers, initialization, and stale recovery code
- [ ] Stage 3 — page-specific, weather/GPS, threat-zone, and profile rendering repairs
- [ ] Stage 4 — proven unused assets/files/dependencies

## Validation log

- `npm run typecheck`: passed before cleanup work.
- `npm run lint`: passed with 9 existing `no-explicit-any` warnings in `test/guided-response-decision-builder.test.ts`.
- Full Vitest baseline: 52/54 files and 549/569 tests passed; 20 existing failures remain in `test/plume-map-views.test.ts` and `test/notification-center.test.ts` and must be resolved or documented during cleanup.
- Focused guided-response/Incident Command tests: 60 tests passed before cleanup work.
- Stage 1 validation: `npm run typecheck` passed; `npm run lint` passed with the same 9 warnings; focused UI run passed 84 tests and retained 15 known static-contract failures in `test/plume-map-views.test.ts`.
- Stage 1 change: removed obsolete Plume hero-header rules from the shared shell stylesheet; the active Plume page remains toolbar-first with the canonical two-track workspace geometry.
