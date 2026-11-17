# EMERGENZ local release review — November 17, 2026

This report records verification completed before release authorization. The user subsequently authorized committing and pushing this reviewed candidate to the Render preview branch. The original workspace is preserved.

## Branch and scope audit

The canonical origin is `https://github.com/FireFight221/hazmatiq.git`.
Remote verification returned development `37ad200081d88b9e463e5a7b74373468b9d0644b` and current-hazscope-migration `615b6096836f02aec8fb15afd37a006e8b40886a`.
All four commits in origin/development..HEAD already exist on the Render branch with identical SHAs:

- `6b7e58b`: Tier II secret-file startup handling and tests.
- `90005ac`: ICS organization workflow and shared assignment tests.
- `9009841`: preview UI/verification updates.
- `615b609`: EMERGENZ shared navigation, profile, and worksheet fixes.

HEAD and the Render branch have identical trees and no unmatched cherry-picked patches. None of these four commits needs to be replayed, whether by SHA or patch equivalence. Branch membership does not verify the deployed Render service SHA.

The candidate worktree is `/tmp/emergenz-threat-release`, detached from the verified Render base. Changes are copied by an explicit path list, never by copying the dirty workspace wholesale.

Included Threat Zone hunks: completed-input snapshots, duration/endpoint/units presentation, current-result ownership and invalidation, saved 2D replay, Command evidence fields, receptor source availability and provenance, and matching regression tests and audit reports. Included map hunks: radar source lifecycle/readiness, Street vector-source failure recovery, camera preservation, and compatible guide-label fonts.

Excluded: all `styles.css` edits, Tactical Worksheet/chart/title changes, index asset-version changes, offline-worker/PWA/cache changes and their tests, forms, screenshots, Tier II exports, runtime databases, credentials, and unrelated untracked files. In the mixed `script.js`, only Threat Zone and the explicitly requested map-repair hunks are included. No 2D calculation or 3D model code is changed.

## Saved incident replay

The originally affected incident is **unavailable/unidentified**: the user supplied no saved name or ID. A local saved record, `Monday Madness Preview`, incident `117e3090-13ae-48d5-a667-bc59c7f179d8`, was replayed as an active browser-only test copy. The completed original was neither reopened nor written back. Browser API writes were intercepted; the incident JSON is a temporary local input and is not included in the candidate.

Saved run: `plume-workflow-1793048524318`, computed `2026-10-26T21:02:03.682Z`.
Ammonia (anhydrous), CAS 7664-41-7, HazMatIQ Planning Estimate, Gaussian screening model version `0.1.1-plume-screening`.
Stored operator release: continuous, 1500 lb/min, 11.33980925 kg/s; MC-331 pressure cargo tank. Release duration was not retained and remains **Not recorded**.
Stored weather: Open-Meteo observation `2026-10-26T21:00:00.000Z`, 5.4 mph from 26 degrees, 72.6 F. This is a historical run snapshot, not current weather.
Endpoint source: EPA final 60-minute AEGL, ppm.

| Zone | Endpoint | Saved downwind distance |
| --- | --- | --- |
| AEGL-3 | 1100 ppm | 786.5708377066387 m |
| AEGL-2 | 160 ppm | 2633.9113173374926 m |
| AEGL-1 | 30 ppm | At least 5000 m; computational boundary |

Before: Command displayed PLOTTED while the Plume popup showed Awaiting model and no completed run. Opening Plume followed a fresh GPS/weather/calculation path instead of replaying the saved result.
After: both widths (1440 and 390) restore the same run ID, endpoint duration, exact saved GeoJSON, and distances without making a model request. Command and Plume MapLibre source data match the saved geometry. Popup lists the saved named targets. Changed inputs invalidate the current result while retaining historical geometry; switching incidents clears the old result.

The saved NCES locations for Linda Nolen Learning Center, STAR Program Elementary, and STAR Program Middle (33.30759599950465, -86.78218400043161) classify into AEGL-1 using the backend classifier and the actual rendered map hit test. These are three source records at one coordinate, not three independent geographic control points.

For the exact saved polygon, a separate fresh-source lookup took 850 ms cold and 53 ms repeat on the workspace server. Both responses returned the three school records and FRA crossing 639537G in AEGL-1. These timings are environment-specific, include HTTP/provider overhead, and are not a service-level guarantee. The saved three-target historical snapshot is not silently replaced by this four-target fresh lookup.

## Map regression evidence

Weather location from the screenshot: 33.1649, -86.7900. After switching NOAA to RainViewer, the original code retained NOAA's tileSize 512 and maxzoom 17. RainViewer requests at zoom 9 returned HTTP 200 image/png with the literal message **Zoom Level Not Supported**, visually confirmed from the downloaded response. Fire is a separate GeoJSON/marker feed and does not produce these raster images.

The repair recreates the raster source when native zoom limits, tile size, or attribution change. RainViewer requests stay at native zoom 7 or below while the user's map remains at zooms 6, 9, 12, and 16. Status waits for tile readiness and reports unsupported lower zooms without moving the whole map. Provider reference: https://www.rainviewer.com/api/weather-maps-api.html .

Street returned real OpenFreeMap vector tiles, sprites, and Noto glyphs during the normal test. However, an error carrying a vector source ID bypassed the existing Satellite fallback, leaving Street selected on an incomplete basemap. The repair recognizes that source failure, selects the existing Satellite fallback, restores overlays, and retains center/zoom/bearing/pitch and the release pin. Satellite remains visible while Street is initializing. Optional guide labels now request the provider's Noto font instead of the default Open Sans/Arial stack that returned HTTP 404.

Browser regression checks cover cold contexts and contexts controlled by an installed service worker, Radar/Fire/Alerts toggles, real JPEG/vector tile responses, Street/Satellite switches, and a deliberately failed vector tile request. Saved zone GeoJSON and release coordinates remain unchanged. Temporary screenshots/network captures are outside Git.

## Remaining limits

- The originally affected incident and authenticated Codespaces/Render browser session are not verified by this representative replay.
- CMS nursing-home requests still return HTTP 403 here; that source is labeled unavailable. Residential/commercial/doctor-office inventory coverage is still missing, not zero occupancy.
- No independent ALOHA validation, physical-model adjustment, or 3D change is claimed.
- A source's HTTP success alone does not establish live radar accuracy or current occupancy.
- Live Render deployment verification is separate from branch and local-test verification.

## Final local verification

- Isolated Render-based candidate: 676 root tests passed, zero failed. Root and server typechecks passed. Lint: zero errors, nine pre-existing warnings.
- Focused Threat Zone/map/3D checks: 41 passed. The source-limit, readiness, and unsupported-zoom assertions also passed after the last radar-status adjustment.
- Full server run: 105 passed, one five-second Docker/Tier II startup timeout. The same test timed out on the unchanged clean Render baseline. Its complete two-test file passed in isolation with an explicit 15-second timeout (the import case completed in 3.4 seconds). Startup code and its tests were not changed to mask this timing failure.
- Exact candidate browser on port 3001: Street/Satellite real tiles, native radar zoom at most 7, Radar/Fire/Alerts toggles, pin/geometry/camera preservation, and forced vector-source fallback passed without a worker and under an active worker. A separate controlled reload under the active worker passed too.
- The representative saved replay passed at 1440 and 390 pixels, including rendered school placement and incident/input invalidation. The originally affected incident remains unidentified.
- Release staging and commit occur only in the isolated worktree, using the explicitly reviewed paths. The user's original dirty workspace remains intact.
