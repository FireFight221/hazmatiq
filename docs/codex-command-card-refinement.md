# Codex task: two-card Incident Command refinement

Work in the canonical FireFight221/hazmatiq repository on development. Verify origin and the current branch before editing. Do not create another branch. Keep current-hazscope-migration, the Render preview branch, unchanged.

1. SAVE FIRST. Inspect git status and diffs. If there are unfinished legitimate edits, review and checkpoint them before changing code. Exclude credentials, runtime databases and temporary screenshots. Record the starting SHA. Do not reset, discard or overwrite unrelated work.

2. Read AGENTS.md, CONTRIBUTING.md and docs/branch-consolidation-2026-10-26.md. Audit the current DOM, CSS ownership and status persistence handlers before editing. Preserve Decision Flow immediately below the header, the four compact incident cards, counted involved-chemicals popup and weather below the incident cards.

3. Replace the three lower Command panels with TWO large cards: Incident Brief and Guided Response. Use two columns on desktop and stack cleanly on smaller screens. Give Incident Brief the existing GOLD Operational Status accent. Keep Guided Response GREEN and replace its icon with the shield currently used by Operational Status. Remove the standalone Operational Status card.

4. Move the useful Operational Status controls and information into Guided Response. Combine protective actions, PPE/entry, decon, medical/rehab, facility, plume and monitoring as relevant. Show each recommendation once; eliminate repeated summaries and duplicate evidence paragraphs. Retain a concise phase/priorities flow and distinguish recommendation/source evidence from commander-confirmed completion. Keep the same incident data model; no parallel status store.

5. FIX THE DROPDOWNS. Trace selection events through the active incident, persistence and rerender. Verify Not Started, In Progress, Complete and Not Applicable actually update the correct task, survive reload and remain isolated between incidents. Preserve required completion evidence and explain validation visibly rather than silently reverting a selection. Ensure Medical/Rehab is not mapped to Documentation. Do not mark future phases complete automatically.

6. The Guided Response decision-support area must provide working actions for Chemical / PPE, Plume Model, Live Map and Incident Reports using existing navigation and active incident context. Preserve access to the full Guided Response page and its return navigation. Do not duplicate whole Incident Brief paragraphs or add another tab bar.

7. Use the existing font family with bold labels, readable body text and high contrast. Let containers grow and wrap without overlaps, tiny circular text buttons, clipped controls or nested scroll traps. Edit the owning CSS rules and remove obsolete section rules; do not add another correction stylesheet or global override layer. Keep unrelated platform pages unchanged.

8. Validate behavior, not just source strings: change each status, reload, switch incidents, verify notes/assignment context and all four actions. Update affected regression tests meaningfully. Run root/server TypeScript, root lint and root/server tests. Check desktop, tablet and phone layouts with long incident and chemical names. Show real before/after screenshots when possible; report a blocked preview explicitly.

9. Commit and push reviewed changes to development only. Report the starting/final SHAs, files changed, checks and remaining issues. Do not merge or push to current-hazscope-migration and do not deploy Render; preview promotion waits for review.
