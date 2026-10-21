# Plume model and 3D rendering audit

## Release boundary

The authoritative backend model remains a two-dimensional Gaussian screening
model. `src/lib/model/plume.ts` calculates concentration in kg/m³ at selected
points, converts approved AEGL thresholds to map units, and returns horizontal
AEGL isopleths and a centerline. It does not return a validated 3D
concentration field.

The browser-only `HazScope 3D Dispersion Model v2` is a separate screening
visualization. It reuses the existing Briggs sigma-z families, the current
release and weather inputs, the 2D AEGL footprint, and optional terrain or
building context to construct vertical sections for operational orientation.
The result is explicitly an estimated vertical envelope, not CFD, not a
validated 3D concentration prediction, and not a safe-boundary surface.
The horizontal AEGL zones retain their existing meaning and remain
authoritative for the modeled 2D result.

## Data flow and root causes repaired

The repaired path is:

`3D Plume` button → `activePlumeMapView` → vector/tactical style → current
AEGL model result → vertical section geometry → MapLibre custom WebGL layer →
camera/ground view.

The previous failure had two independent causes:

1. The map always initialized with the local satellite raster style. When the
   operator selected 3D Plume, the tactical-style builder received no saved
   vector style and returned `null`; the view therefore fell back to Satellite.
   The repair uses the current vector style when available and otherwise asks
   for the configured vector style, with a visible fallback message if the
   provider cannot load it.
2. 3D Plume incorrectly required the optional terrain DEM. A missing DEM
   caused a valid custom plume layer to be replaced by Satellite. 3D Plume
   now renders against a clearly labeled flat-ground baseline when the DEM is
   unavailable. Terrain remains a separate optional `3D Terrain` context mode.

The renderer also rejects stale asynchronous plot requests before they can
replace a newer model result or save an older map image.

## Model inputs and assumptions

- Horizontal concentration uses the existing Gaussian plume/puff equations,
  release height, wind speed, stability, and surface roughness.
- Vertical section spread reuses the existing Briggs sigma-z families rather
  than introducing a second incompatible dispersion family.
- Vapor density is derived from an approved measured value or molecular
  weight relative to air when permitted by the current chemical profile.
- Liquid specific gravity is kept separate from vapor density and is only used
  in the existing liquid source-term modifier.
- Vapor pressure is a source-term modifier for liquid release behavior; it is
  not an arbitrary vertical-height multiplier.
- Humidity and temperature remain contextual, bounded screening modifiers.
- Terrain elevation and building wakes affect the illustrative section
  geometry only when the relevant map data is available.

Unsupported by this release: CFD, validated building-airflow simulation,
validated dense-gas 3D concentrations, time-resolved 3D chemistry, or any
claim that the rendered mesh is a concentration threshold boundary.

## Primary references

- [US EPA: Air Quality Dispersion Modeling — Preferred and Recommended Models](https://www.epa.gov/scram/air-quality-dispersion-modeling-preferred-and-recommended-models)
- [US EPA: AERMOD Model Formulation and Evaluation](https://gaftp.epa.gov/AIR/aqmg/SCRAM/models/preferred/aermod/aermod_mfd_454-R-03-004.pdf)

These references establish the distinction between recognized atmospheric
dispersion modeling and this application's explicitly limited operational
screening visualization. No new scientific validation claim is made by this
repair.
