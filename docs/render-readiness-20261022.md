# EMERGENZ Render readiness audit — 2026-10-22

## Recovery and scope

Audited the actual Codespace branch `plume-model-repair-20261021` at `0fe65e76fb4193ffd1f64c35df3b209e7180a313`, including the recovery/checkpoint commits after both shutdowns. Saved and pushed the unchanged source to `personal/backup/pre-render-audit-20261022` before editing. Continued on `audit/render-readiness-20261022`. Existing preview PNGs and runtime databases were preserved without adding them to the deployment.

## Requested work and evidence

| Request | Finding |
| --- | --- |
| Facility-first Command lookup | Browser verified name search before chemical selection, facility selection and popup inventory. Pelham search returned 23 matches. Colonial Pipeline Company exposed two reported records with source metadata. Missing facilities cannot be inferred from the current imported inventory. |
| Compact equal Command cards | Repaired fixed height overflow; four populated cards measured 179px each with no scroll overflow at the audited desktop viewport. Restored selected facility name after reload. |
| Incident Brief / status / guidance readability | Reflowed status title, source, description and controls; removed repeated evidence paragraphs; replaced 20px status circles with readable text buttons; removed fixed panel-heading heights. |
| Operational Status | Explicit commander-controlled states remain separate from system evidence. Fixed medical/rehab being incorrectly mapped to documentation. |
| Operational Mode | Persists strategy, timestamp, identity and timeline history and includes history in the incident report. Does not currently change tactical guidance or automatically select ICS forms. Help text now states actual behavior. Strategy-sensitive guidance/document prompts remain a future enhancement. |
| Plume inputs / controls / distance contrast | Previous white-on-navy and light distance popup fixes preserved. Improved action button contrast. Toolbar responsive implementation and tests preserved. |
| Threat Zone content | Completed distinct AEGL, Distance Table and Model Details panels. Real tab visibility, keyboard navigation and completed-run input snapshot. Facilities/details immediately visible. Larger type; one dialog scroll surface; honest unavailable counts. Crosswind values labelled half-width, not downwind. |
| Guided Response | Seven phases, book header, phase icons, GOAL, four guidance sections, notes, goal state and next task preserved. Contextual Back, assignment/update and Live Map / ICS mappings preserved with regression coverage. Fixed future phases falsely marked complete in Command. |
| Source status boxes | Prior source-box removal preserved. Actual references remain available. |
| 3D plume | Existing rendering repair preserved. Existing audit documents a screening visualization, not a validated 3D concentration/CFD solver. Cloud browser explicitly cannot create WebGL context; no successful 3D visual verification is claimed. |

## Validation

- Codespace root full suite: 55 files, 589 tests passed after repairs.
- Codespace root TypeScript: passed.
- Codespace lint: no errors; 9 pre-existing warnings.
- Server suite: 6 files, 72 tests passed; server TypeScript passed.
- `git diff --check`: passed.
- Browser checked populated Command, real facility lookup/inventory, restored facility after reload, loaded Open-Meteo weather, Guided Response and navigation.
- Threat panel runtime tests cover completed-run values, distinct panels, keyboard/tab state, missing data and truthful facility counts.
- No claim of exhaustive cross-browser or all-device certification. Current visual check was desktop Chrome. Existing mobile layouts/tests were preserved.

## Deployment follow-up

Render deployment is left to the owner. Its existing persistent database is not replaced by a code push; imported facility inventory availability there must be checked independently. Confirm GPU/WebGL 3D behavior on deployment in a normal supported browser. This audit does not certify the platform for operational use.

## Owner-requested screen-space correction

Removed the unrequested Open Incident Responses horizontal strip from Command, including its markup, renderer/export and unused styles. Existing incident records and Reports incident navigation remain. Verified no strip in the browser and top cards directly below the header. Affected Incident Command/navigation tests and root TypeScript passed.

## Command layout continuation — October 26

Promoted Command Decision Flow to the first content section below the page header. Moved weather below the four incident cards. Removed the full-width involved-chemicals band and its redundant preview renderer/styles. Kept the complete list and identifiers in the existing dialog, opened by a counted View Involved Chemicals button in the Chemical / Hazard card. Removed the repeated selected chemical name from that card to preserve space. No incident or facility inventory records were deleted.

Focused Command/facility/navigation tests: 23 passed. Root TypeScript and JavaScript syntax checks passed. Browser visual verification of the resumed final edit was blocked by the browser URL policy; the earlier layout preview was verified on October 22.
