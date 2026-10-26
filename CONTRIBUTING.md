# EMERGENZ working guide

## One repository, two active branches

Canonical repository: FireFight221/hazmatiq.

| Branch | Purpose |
| --- | --- |
| development | Implementation, CSS work, fixes and saved checkpoints. |
| current-hazscope-migration | Stable preview used by the existing Render app. |

Keep the preview branch name to preserve the Render connection. Use development for all routine work; do not create frontend/backend, feature or recovery branches. Historical tips are preserved under archive/2026-10-26/ tags. The cmc2765 repository is a legacy source, not another development location.

## Daily work

    git switch development
    git pull --ff-only origin development

Edit, checkpoint and push development. Stage reviewed paths, avoiding runtime databases, credentials and temporary screenshots.

## Preview promotion

Open a pull request from development into current-hazscope-migration. Run checks and review affected screens on desktop and phone before merging. Leave failed or visually unverified changes on development. Do not edit preview directly or force push. Deploy the reviewed preview commit through the existing Render service. Code pushes do not migrate its persistent facility database.

## Implementation and validation

UI belongs in server/public; API/database in server/src; shared data/models in src/data and src/lib. Fix the owning CSS file rather than adding another override layer. Preserve API contracts and offline field workflows.

    npm ci
    npm --prefix server ci
    npm run typecheck
    npm --prefix server run typecheck
    npm run lint
    npm test
    npm --prefix server test

The EMERGENZ verification workflow runs these checks for the two active branches and pull requests. Browser QA remains part of promotion.

## Local app and recovery

Run npm --prefix server run dev and open its forwarded port. Initialize and seed only a new development database; preserve existing incident and imported facility data.

The branch audit and recovery map are in docs/branch-consolidation-2026-10-26.md and docs/branch-audit-2026-10-26.json. Restore an archived tip by its recorded tag for historical investigation. Keep routine work on the two active branches.
