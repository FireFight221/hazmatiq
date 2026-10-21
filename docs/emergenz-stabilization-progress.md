# EMERGENZ stabilization progress

Updated: 2026-10-21

## Guided Response refinement recovery

- Current task: keep the existing seven-phase Guided Response workflow intact while placing Operational Guidance left and its sole Command Actions panel in a right-side vertical column.
- Current branch: `plume-model-repair-20261021`
- Recovery checkpoint: `751cb58` (`Recovery checkpoint before Guided Response refinement`)
- Implementation checkpoint: `97ae923` (`Refine Guided Response action palette and phase icons`), following `a5681ec`, `e3162c3`, and `f2018d6`.
- No merge or rebase is in progress. The prior Plume distance popup, Operational Guidance, facility search, Command layout, Threat Zone tabs, and plume work remains preserved in earlier commits.
- Completed in this stage: Guided Response now uses the shared compact EMERGENZ page-header contract with an inline open-book icon; the old Guided-only hero rules were removed. Seven phase titles use explicit required capitalization and each phase summary has a small inline SVG operational icon. Phase cards now use compact responsive spacing, explicit Goal Status and Next Decision / Task elements, bottom-of-phase Commander Notes / Observations with debounced autosave, and useful References disclosures only when source records exist.
- Completed in this stage: assignment activation validates Personnel / team, Unit / resource, and Responsibility; Assign confirms a new assignment by default, Update reuses the stable phase assignment ID, and assignment history/timeline records are persisted. Unplaced resources retain `Location not set`; Live Map lists them and provides explicit click-to-place/reposition behavior without invented coordinates. The authoritative server ICS mapper now carries assignments/history into the rendered ICS 203/204/214/215 fields.
- Completed in this stage: the duplicate bottom Command Actions panel was removed. Operational Guidance and the same existing command buttons now share one responsive workspace: Guidance occupies the left column, while Command Actions is the only right-side vertical action column on desktop and stacks below on mobile.
- Completed in this stage: the Command Actions palette now follows the requested order and labels — Open Command Dashboard (white), Hazard ID (yellow), Open Plume Model (red), and Save to Incident (navy); the existing tactical-record action remains available in the same navy family. The green phase-progress bar was removed. Phase title boxes are light green with dark text, phase icons use bold strokes, Reconnaissance and Assessment uses binoculars, and Withdraw / Decontaminate / Medical-Rehab uses a flowing shower-head icon.
- Completed in this stage: the redundant bottom Source / Technical Detail box is no longer rendered. Phase-level References disclosures and provenance/source metadata remain intact.
- Browser evidence: [prior Guided Response before screenshot](../guided-desktop.png), [repaired Guided Response desktop screenshot](../guided-response-refinement-after.png), [repaired Guided Response mobile screenshot](../guided-response-refinement-mobile.png), and [active-incident Guided Response evidence](../guided-response-refinement-after-active.png). Chromium computed the shared header at `112px` desktop / `100px` mobile; seven phase icons rendered; active assignment editing retained one stable record and displayed `Update`; Live Map displayed `Location not set` and `Place on Map`; the earlier placement pass persisted explicit coordinates and rendered one assignment marker. The repaired Plume distance popup evidence is [here](../contrast-audit-plume-distance-popup.png).
- Runtime verification: port 3000 remained occupied by an unavailable process, so the checkout was verified on fresh ports `3311` and `3312`. Served `index.html` and `script.js` on 3311 matched the local checkout hashes (`5bf93a…ec197b` and `459524…0058`); the fresh 3312 backend served the updated ICS mapper and rendered `Unit 4` plus `Entry Team 2 · Entry Team · Initial Perimeter` in ICS 203.
- Checks run: focused Guided Response / Incident Command / hazard-flow / decision-builder tests passed `73/73`; fresh server API suite passed `46/46`; full root Vitest passed `54` files / `580` tests; root and server typechecks passed; `npm run lint` completed with 0 errors and 9 existing `no-explicit-any` warnings; `git diff --check` passed. Existing Plume map-view coverage passed `59` tests, and prior interactive contrast evidence covered Satellite, Street, 3D Terrain, and 3D Plume states.
- Checks run: Guided Response UI tests passed `35/35`; browser computed a `1112px` Guidance left column and `270px` right action column at 1440px, five buttons in one vertical flex column, and zero bottom-level Command Actions panels. At 390px, the workspace collapsed to one column with actions below the Guidance content. Evidence: [command-column screenshot](../guided-response-command-column.png).
- Checks run: latest focused Guided Response UI tests passed `36/36`; typecheck passed; lint passed with 0 errors and the same 9 existing `no-explicit-any` warnings; `git diff --check` passed. Prior live-browser verification computed the requested white/yellow/red/navy action colors, light-green phase title styling, bold icon strokes, and zero rendered progress bars; the latest label/order changes are covered by the focused suite. Evidence screenshots remain intentionally untracked and no secrets or runtime databases were staged.
- Outstanding: no implementation blockers. Port 3000 remains occupied by an unavailable process; a fresh-server browser rerun was blocked by the Codespace sandbox networking policy, so the latest rendered label/order change is additionally covered by static tests. The exact action colors and phase rendering were already verified in the preceding fresh-server browser pass.
- Exact next step: hand off the verified local implementation; do not push or deploy.

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
- [x] Stage 3 — page-specific, weather/GPS, threat-zone, and profile rendering repairs
- [x] Stage 4 — proven unused assets/files/dependencies audit (no safe deletions identified)
- [x] Verification cleanup — removed inactive Plume hero selectors and refreshed stale static contracts to match the approved toolbar-first shell

## Validation log

- `npm run typecheck`: passed before cleanup work.
- `npm run lint`: passed with 9 existing `no-explicit-any` warnings in `test/guided-response-decision-builder.test.ts`.
- Full Vitest validation after cleanup: 54/54 files and 572/572 tests passed.
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
- Stage 4 audit: package dependencies are referenced by the application/test toolchain. Candidate legacy image files are retained because shared CSS, tests, or indirect/template conventions still reference the surrounding asset families; the hidden `monitor-legacy` markup remains coupled to monitoring selectors and IDs. No asset, source file, or dependency was deleted without proof.
- Verification cleanup: removed the remaining inactive `.variant-plume` hero rules from `styles.css` and `hero-overrides.css`, and updated the two stale static-contract suites to assert the current compact shell, one-track toolbar/workspace geometry, live-map-only radar controls, and no Plume hero. Final full suite: 54 files, 572 tests passed.

## Incident Command compact-card stage

- Commit: `45a719fab72032b89c0849cabbacb3b37401a8ae` (`Compact Incident Command summary cards`)
- The four Incident Command summary cards now use content-sized desktop grid tracks and responsive stacked tracks without fixed row stretching.
- Involved chemicals now render in a separate compact full-width inventory band between the summary cards and Command Decision Flow. The preview shows a count and up to four rows; larger inventories remain available through the accessible “View all involved chemicals” dialog.
- Facility inventory additions continue to update `involvedChemicals` only; the explicitly selected plume chemical remains canonical and independent.
- Targeted Incident Command tests: 10 passed. Full Vitest: 54 files, 574 tests passed. Typecheck passed. Lint passed with the same 9 existing warnings.
- Follow-up CSS consolidation removed 27 competing top-board geometry declarations from the older Incident Command passes; card sizing, inventory placement, and responsive tracks now have one authoritative scoped contract.
- Browser screenshots were not captured because this Codespace has no browser-control runtime.
