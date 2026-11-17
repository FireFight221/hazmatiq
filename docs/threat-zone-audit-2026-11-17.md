# Threat Zone presentation and receptor-source audit

Local review only. No deployment or model coefficient changes. The 3D model is unchanged.

## Baseline and test cases

- Live app: https://hazscope-app.onrender.com/ . Its served `script.js` SHA-256 was `536cef1e1446c1b16db81e7946a969b2da54b5aae06878718a153e7d6f80fc3a`, matching release commit `615b6096836f02aec8fb15afd37a006e8b40886a`. This is a served-file match, not Render dashboard confirmation of the full deployed SHA.
- No affected incident ID was supplied. Used a synthetic ammonia run and a browser-local incident named `Audit Threat Zone Test Copy`; live incident records were not changed.
- Ammonia master 10, CAS 7664-41-7; `HAZMATIQ_PLANNING_ESTIMATE`, continuous Gaussian screening plume; 0.07559872833333334 kg/s, 600-second submitted release, ground-level release; rural, stability D; 2.2352 m/s wind from 270 degrees; 20 C, 50% RH; origin 34.0007, -81.0348. Manual weather timestamp 2026-11-17T19:48:25.531Z (1:48:25 p.m. CST).
- EPA final 60-minute AEGL endpoints: AEGL-1 30 ppm, AEGL-2 160 ppm, AEGL-3 1100 ppm. The live result returned AEGL-1 365.77762996728325 m and AEGL-2 148.51304132946552 m; AEGL-3 had no displayable polygon. Footprints and calculated distances were not adjusted.
- A separate receptor-source control polygon was the rectangle west -81.04, east -81.02, south 33.99, north 34.01. This is explicitly **not a modeled plume**, and its target count must not be attributed to the smaller ammonia footprint.

## Findings and changes

1. The model normalizes inputs and omits the submitted release-duration field from `result.inputs`. The UI substituted the editable duration. With the original 600-second run and a 99-minute editable control, the completed summary displayed **99 minutes**. It now retains submitted inputs and displays **10 minutes**; the detailed panel displays **600 s**. Missing historic values remain “Not recorded.”
2. Saved workflow records now retain normalized inputs, submitted inputs, isopleths, thresholds, and exposure duration alongside the existing exact GeoJSON. Zone feature properties retain endpoint value, units, and duration for downstream consumers.
3. Editing inputs cancels pending run responses, clears current displays, marks saved results for recalculation, and prevents the old overlay from being read as current. Historical geometry remains recorded. Command no longer allows an old map-image reference to override the recalculation state.
4. ERG fallback labeling in the operational decision handoff now explicitly says ERG guide, without inventing an AEGL duration or concentration-zone meaning.
5. The live receptor endpoint's catalog omitted property/business inventories and dedicated nursing-home and rail-crossing feeds. The source control returned 10 named healthcare/EMS/public-safety records. With the verified USDOT/FRA crossing layer, the same control returns **21 named records**, including **11 crossings**. Government facilities and nursing homes have distinct presentation categories. This is not evidence of complete occupancy coverage.
6. Malformed or truncated provider responses are unavailable, not successful empty inventories. Invalid/missing coordinate values are not coerced to zero. The popup shows per-source availability, known coverage gaps, dataset dates when supplied, retrieval timestamps, coordinates, and named records.
7. The popup offers a JSON download of the exact per-zone planning snapshot, including geometry, completed run, target inventory, dates, and gaps. This is an offline planning artifact, not a nationwide offline GIS layer package or live feed.

## Government sources and limits

- [NCES school locations](https://nces.ed.gov/programs/edge/Geographic/SchoolLocations): verified the existing NCES-hosted public-school layer and 2024–2025 collection description. Not complete private-school/childcare coverage.
- [USDOT/BTS NTAD](https://www.bts.gov/ntad): verified ArcGIS item `f51a402931a04fe890a568ef88fb81a6`, publisher `USDOT_BTS`, service `NTAD_Railroad_Grade_Crossings`. Publisher description dates the dataset October 9, 2026. Crossings are points classified against the saved polygon; they do not establish road closures or substitute for road/rail segment intersection analysis.
- [CMS nursing-home Provider Information](https://data.cms.gov/provider-data/dataset/4pq5-n9py): implemented the [documented CMS query API](https://data.cms.gov/provider-data/about) using coordinate bounds and retaining reported coordinates and processing dates. Live API and official downloadable CSV returned HTTP 403 from this environment. The failure is visible. Fixture tests verify nursing-home names, coordinates, dates, and zone classification; live nursing-home retrieval is **not verified**. No unverified mirror was substituted. Beds are not current occupancy.
- Existing HIFLD healthcare and public-safety layers remain available, with unknown dataset dates explicitly identified.
- Residential parcels/homes, businesses/doctor-office inventories, full road/rail segments, waterways/gauges, EPA FRS integration, RAPT comparison, and NWS alert-card integration remain outside this first verified inventory pass. Authorized Tier II inventory is unchanged and is not merged into public receptor data.

## Verification and interpretation

- Desktop and mobile browser: named hospital/government/crossing lists, source gaps, dataset date display, incomplete-coverage labels, and downloadable 21-record control snapshot.
- Same 2D result: completed-duration panel and summary agree, raw calculation/zone distances remain unchanged, saved output geometry equals the Live Map transport geometry, and input invalidation rejects current-result reads while preserving history. The source model returned no official critical-facility matches in the smaller ammonia footprint; missing property coverage remains unknown.
- Browser-local save/reload retained the 600-second submitted snapshot. Unit regressions cover pending/current result metadata, missing duration, stale-result ownership, and stale Command map-image references.
- The WebGL map's visual geographic registration and the originally reported incident could not be independently verified from an incident-specific saved example. No ALOHA matched-input or independent dispersion validation is claimed; this pass changes data presentation and handoff, not the 2D/3D physical model.
- Final focused regressions: 40 passed. Server suite: 106 passed. Root/server typechecks passed. Lint: zero errors, nine existing warnings. The full root run retained the previously reported 23 assertions against the unrelated dirty stylesheet (649 passed in that run); the unrelated stylesheet was not edited by this audit.
