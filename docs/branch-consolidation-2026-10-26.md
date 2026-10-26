# EMERGENZ branch consolidation — October 26, 2026

## Working arrangement

Canonical repository: FireFight221/hazmatiq. Development is the working branch. Current-hazscope-migration is the stable Render preview, held at eb3077a during development work. The original cmc2765 repository remains a legacy source; its default main is retained because repository administration belongs to its owner.

## Findings and preservation

The live remote inventory contained 20 branches across two repositories. Codespaces also held 31 local refs and two stale remote-tracking refs. All 53 refs were archived as annotated tags on the canonical repository and verified against their original SHA.

Most histories were already ancestors of preview. Separate mobile changes were inspected: Hazard ID 70/30 query proportions, nine-module phone navigation, mobile homepage layout and regression tests are already ported into the current tree. Their histories were merged without adding duplicate CSS. Personal main is a ten-commit static prototype, superseded by server/public. Local 2eeeb65 is the older navigation/header variant; the newer rebased version and later header/3D changes are retained. Recovery 7a6d7bd is an empty checkpoint.

A history-only merge joins these reviewed tips. The application tree before and after that merge was verified identical to checkpoint b3be0ff. Every audited SHA is an ancestor of development. No source history was dropped.

## Work held on development

Checkpoint b3be0ff moves Command Decision Flow first and compacts the chemical inventory into its existing dialog. It passed 55 root files / 588 tests, TypeScript and lint with 9 existing warnings. Browser access to the resumed final preview was blocked, so the layout was not promoted to Render.

The next two-card Command UI change is delegated to Codex at the owner's request: gold Incident Brief and green shield Guided Response, combining status controls and guidance without repetition. That work has not been implemented in this audit.

## Recovery map

Full SHAs and refs are also in branch-audit-2026-10-26.json.

| Original ref | Saved SHA | Recovery tag | Unique commits before merge |
| --- | --- | --- | --- |
| refs/heads/audit/render-readiness-20261022 | b3be0ffff0 | archive/2026-10-26/local/audit/render-readiness-20261022 | 0 |
| refs/heads/backup/codespaces-interruption-2026-10-05 | 1adcff084e | archive/2026-10-26/local/backup/codespaces-interruption-2026-10-05 | 0 |
| refs/heads/backup/command-dashboard-checkpoint-2026-10-08 | bf55086bd4 | archive/2026-10-26/local/backup/command-dashboard-checkpoint-2026-10-08 | 0 |
| refs/heads/backup/incident-command-checkpoint-2026-10-08 | 240c876aba | archive/2026-10-26/local/backup/incident-command-checkpoint-2026-10-08 | 0 |
| refs/heads/backup/local-updates-2eeeb65 | 2eeeb656dc | archive/2026-10-26/local/backup/local-updates-2eeeb65 | 1 |
| refs/heads/backup/monitoring-before-consolidation-2026-10-14 | 82c7547b33 | archive/2026-10-26/local/backup/monitoring-before-consolidation-2026-10-14 | 0 |
| refs/heads/backup/navigation-weather-checkpoint-2026-10-08 | 45fd72a834 | archive/2026-10-26/local/backup/navigation-weather-checkpoint-2026-10-08 | 0 |
| refs/heads/backup/pre-render-audit-20261022 | 0fe65e76fb | archive/2026-10-26/local/backup/pre-render-audit-20261022 | 0 |
| refs/heads/backup/render-before-consolidation-2026-10-14 | 0225a70a2f | archive/2026-10-26/local/backup/render-before-consolidation-2026-10-14 | 0 |
| refs/heads/backup/verified-render-20261022 | 9fb63bf3ba | archive/2026-10-26/local/backup/verified-render-20261022 | 0 |
| refs/heads/backup/weather-live-map-precleanup-2026-10-09 | 0225a70a2f | archive/2026-10-26/local/backup/weather-live-map-precleanup-2026-10-09 | 0 |
| refs/heads/broken-state-before-restore | 1aa489a641 | archive/2026-10-26/local/broken-state-before-restore | 0 |
| refs/heads/cbrne-extraction-recovery | 9cc0fc0274 | archive/2026-10-26/local/cbrne-extraction-recovery | 0 |
| refs/heads/cleanup-emergenz-from-checkpoint-20261015-2256 | 2b7cf21ccd | archive/2026-10-26/local/cleanup-emergenz-from-checkpoint-20261015-2256 | 0 |
| refs/heads/core-validation | 36d5c394f8 | archive/2026-10-26/local/core-validation | 0 |
| refs/heads/emergenz-consolidation | fb1fed2a95 | archive/2026-10-26/local/emergenz-consolidation | 0 |
| refs/heads/feature/monitoring-console-v1 | 82c7547b33 | archive/2026-10-26/local/feature/monitoring-console-v1 | 0 |
| refs/heads/frontend | 5abd248b99 | archive/2026-10-26/local/frontend | 0 |
| refs/heads/incident-command-audit-20261021 | 1c3da0e211 | archive/2026-10-26/local/incident-command-audit-20261021 | 0 |
| refs/heads/integration-emergenz-render-20261016 | 22422e8dc6 | archive/2026-10-26/local/integration-emergenz-render-20261016 | 0 |
| refs/heads/layout-check | bff3be99c5 | archive/2026-10-26/local/layout-check | 0 |
| refs/heads/main | c0413c8d1d | archive/2026-10-26/local/main | 0 |
| refs/heads/map-consolidation-cleanup | f2aeb76fdd | archive/2026-10-26/local/map-consolidation-cleanup | 0 |
| refs/heads/plume-map-2.0 | 1a7f402ef8 | archive/2026-10-26/local/plume-map-2.0 | 0 |
| refs/heads/plume-model-repair-20261021 | 0fe65e76fb | archive/2026-10-26/local/plume-model-repair-20261021 | 0 |
| refs/heads/recovery-emergenz-render-checkpoint-20261016 | 7a6d7bd362 | archive/2026-10-26/local/recovery-emergenz-render-checkpoint-20261016 | 1 |
| refs/heads/recovery-emergenz-wip-20261015-2256 | 0f54c6cb1b | archive/2026-10-26/local/recovery-emergenz-wip-20261015-2256 | 0 |
| refs/heads/recovery-incident-command-audit-20261021 | bd921faaf9 | archive/2026-10-26/local/recovery-incident-command-audit-20261021 | 0 |
| refs/heads/recovery-plume-model-audit-20261021 | 2761db5775 | archive/2026-10-26/local/recovery-plume-model-audit-20261021 | 0 |
| refs/heads/ui-consolidation | 55cd20157f | archive/2026-10-26/local/ui-consolidation | 0 |
| refs/heads/ui-consolidation-v2 | 919d1dcffb | archive/2026-10-26/local/ui-consolidation-v2 | 0 |
| refs/remotes/origin/backend | dbfbadb325 | archive/2026-10-26/origin/backend | 0 |
| refs/remotes/origin/backup/command-dashboard-checkpoint-2026-10-08 | bf55086bd4 | archive/2026-10-26/origin/backup/command-dashboard-checkpoint-2026-10-08 | 0 |
| refs/remotes/origin/backup/monitoring-before-consolidation-2026-10-14 | 82c7547b33 | archive/2026-10-26/origin/backup/monitoring-before-consolidation-2026-10-14 | 0 |
| refs/remotes/origin/backup/weather-live-map-precleanup-2026-10-09 | 0225a70a2f | archive/2026-10-26/origin/backup/weather-live-map-precleanup-2026-10-09 | 0 |
| refs/remotes/origin/broken-state-before-restore | 1aa489a641 | archive/2026-10-26/origin/broken-state-before-restore | 0 |
| refs/remotes/origin/cbrne-extraction-recovery | 9cc0fc0274 | archive/2026-10-26/origin/cbrne-extraction-recovery | 0 |
| refs/remotes/origin/core-validation | 36d5c394f8 | archive/2026-10-26/origin/core-validation | 0 |
| refs/remotes/origin/emergenz-consolidation | dd7d99198e | archive/2026-10-26/origin/emergenz-consolidation | 2 |
| refs/remotes/origin/feature/monitoring-console-v1 | 82c7547b33 | archive/2026-10-26/origin/feature/monitoring-console-v1 | 0 |
| refs/remotes/origin/fix/hazard-id-mobile-search-width | dd7d99198e | archive/2026-10-26/origin/fix/hazard-id-mobile-search-width | 2 |
| refs/remotes/origin/fix/mobile-nine-tile-navigation | 31d147f1fc | archive/2026-10-26/origin/fix/mobile-nine-tile-navigation | 3 |
| refs/remotes/origin/frontend | 5abd248b99 | archive/2026-10-26/origin/frontend | 0 |
| refs/remotes/origin/main | c0413c8d1d | archive/2026-10-26/origin/main | 0 |
| refs/remotes/origin/map-consolidation-cleanup | f2aeb76fdd | archive/2026-10-26/origin/map-consolidation-cleanup | 0 |
| refs/remotes/origin/plume-map-2.0 | 88702139ee | archive/2026-10-26/origin/plume-map-2.0 | 2 |
| refs/remotes/origin/ui-consolidation | 55cd20157f | archive/2026-10-26/origin/ui-consolidation | 0 |
| refs/remotes/origin/ui-consolidation-v2 | 919d1dcffb | archive/2026-10-26/origin/ui-consolidation-v2 | 0 |
| refs/remotes/personal/backup/pre-render-audit-20261022 | 0fe65e76fb | archive/2026-10-26/personal/backup/pre-render-audit-20261022 | 0 |
| refs/remotes/personal/backup/render-before-consolidation-2026-10-14 | 0225a70a2f | archive/2026-10-26/personal/backup/render-before-consolidation-2026-10-14 | 0 |
| refs/remotes/personal/backup/verified-render-20261022 | 9fb63bf3ba | archive/2026-10-26/personal/backup/verified-render-20261022 | 0 |
| refs/remotes/personal/current-hazscope-migration | eb3077accd | archive/2026-10-26/personal/current-hazscope-migration | 0 |
| refs/remotes/personal/main | 72100b0d8a | archive/2026-10-26/personal/main | 10 |

## Verified final arrangement

- Canonical repository has exactly development and current-hazscope-migration; development is the default branch.
- Codespaces has exactly those same two local branches. Origin now points to FireFight221/hazmatiq; legacy points to cmc2765/hazmat-response-support.
- Retired 18 redundant remote branch names after SHA, recovery-tag and ancestry checks. The original repository retains only its default main as a historical reference.
- All 53 archived histories remain ancestors of development and have verified remote recovery tags.
- Preview remains eb3077a; no Render deployment was triggered. New layout work remains on development.
- Root suite: 55 files, 588 tests passed. Root/server TypeScript and JavaScript syntax passed. Server suite passed. Lint has no errors and 9 existing warnings.
- Added full root/server CI checks on the two working branches and retargeted the existing Monitoring browser workflow to those branches.
- The two-card Command redesign was not implemented in this audit; a separate Codex handoff is provided.

## CI follow-up

Full-platform GitHub verification passed. The existing Monitoring browser smoke exposed an obsolete 17-unit assertion: the starter inventory now has 19 units, including Rigaku Raman and HazMatID FTIR. Its expected count was updated to 19 without changing the application. The next run verifies that correction. The owner delegated the two-card UI change to Codex; its copy-ready task is in docs/codex-command-card-refinement.md.
