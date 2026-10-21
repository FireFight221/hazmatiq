# Incident Command control decision

## Baseline findings

- Incident Command currently calls `/api/facilities`, which searches the legacy `facilities` table. The running local database contains 6 legacy facilities, 105 imported E-Plan/Tier II facilities, 442 Tier II chemical rows, and all 442 chemical rows are linked to a Tier II facility. Live Map calls the separate bounds-only `/api/tier2/facilities` route, so the two surfaces do not use the same search contract.
- The Command facility detail path currently assumes the legacy flattened response shape. The Tier II detail route returns `{ facility, chemicals, contacts }`, so selecting an imported Tier II facility cannot reliably populate the Command record.
- The available Pelham records are industrial/commercial Tier II records. No `Pelham Civic Complex` or `500 Amphitheatre Rd` record exists in the running source data, and no ammonia inventory should be inferred from that screenshot.
- Operational Status currently derives badges and `COMPLETE` labels from available guidance, source statuses, plume output, or monitor assignments. Those are system/data states, not commander-confirmed field tasks.
- Operational Mode currently persists a selected label and appears in summaries/ICS prefill, but has no mode-change history and does not authorize entry or change scientific guidance.

## Implementation decision

Incident Brief owns incident facts and current context. Facility selection owns verified facility identity and reported inventory. Reported inventory remains explicitly labeled as reported; adding an inventory row to the incident records involvement for the incident but never changes the single explicit plume chemical automatically.

Operational Status owns an incident-persisted checklist. Each task has one of `Not started`, `In progress`, `Complete`, or `Not applicable`. Guidance availability, imported records, saved plume output, and deployed monitors remain evidence/context indicators unless the commander explicitly confirms the corresponding task. Every status change records time, available user identity, source (`system` or `commander`), and a history entry. Reopening a task changes the current state without deleting history.

Operational Mode owns commander strategy. Selecting a mode persists the mode, timestamp, available user identity, and an append-only change record. Mode changes appear in the incident timeline and report/export output. Mode selection may prioritize existing source-backed guidance sections, but it does not invent PPE, isolation distances, or tactical recommendations and never proves conditions are safe.

