# DEGADIS 2.1 (EPA) — vendored heavy-gas dispersion model

EMERGENZ uses the U.S. EPA DEGADIS 2.1 dense-gas dispersion model for gases that
are denser than air and whose source Richardson number is at least 1, the same
heavy-gas selection rule that NOAA/EPA ALOHA uses (ALOHA Technical Documentation,
section 4.4.1). Gases lighter than air, or dense but passive, use the ALOHA-method
Gaussian model in `src/lib/model/alohaMethod.ts`.

## Source

- Download location: https://gaftp.epa.gov/aqmg/SCRAM/models/other/degadis/
  (listed on https://www.epa.gov/scram/air-quality-dispersion-modeling-alternative-models)
- `Degsrc.zip` SHA-256 `0bc75f5d88d0d4bec0489ce96ff9c0b828e521fac4ea13a4f1b12eb3bb2c5a12`
- `DegTestcases.zip` SHA-256 `98804f2046f13c73a3a8785f7092748d8942a567ef9e1c0fd030cba49c6205fb`
- User's Guide: EPA-450/4-89-019, https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=2000J5GU.TXT
- DEGADIS is a U.S. Government work (EPA / U.S. Coast Guard) and is distributed by
  EPA without copyright restriction.

`src/` contains the modules the EPA make files list for DEG1, DEG2S, DEG2 and DEG3.
File names were changed to upper case, and DOS line endings and the trailing ^Z were
removed. No physics was changed.

## Patches (`patches/`)

The diffs are against the line-ending-normalized EPA files.

- `ESTRT1.FOR.diff`: removes `crfger` and `epsilon` from an EQUIVALENCE with the
  read buffer. Modern compilers reject that EQUIVALENCE because it conflicts with
  COMMON /ERROR/ alignment. The two values are now assigned explicitly after the
  buffer is read, so the parameters read in are unchanged.
- `RUNNAME.FOR.diff`: switches the command-line run-name call (`getarg`) from the
  three-argument Microsoft Fortran form to the two-argument gfortran form.
- `TUPF.FOR.diff`: adds empty argument lists to the `TUPF`/`TDNF` function
  declarations so gfortran accepts them. Only the syntax changed.
- `SHIM.F90`: provides `gettim`/`getdat` stubs that replace the VAX/DOS date and
  time calls. They affect only the time stamps printed in report headers.

## Build

```
sh server/vendor/degadis/build.sh            # dynamic, for local development
sh server/vendor/degadis/build.sh --static   # static, used by the Dockerfile (Alpine/musl)
```

The executables go to `bin/`, which git does not track. The server finds them in
`server/vendor/degadis/bin` by default, or at `DEGADIS_BIN_DIR` if that is set. If
the executables are missing, heavy-gas cases fall back to the Gaussian footprint
plus the Britter–McQuaid dense-gas screen, and the plume panel shows a warning.

## Validation

`server/test/degadis.test.ts` runs the EPA reference cases from `testcases/` and
compares the output with EPA's published listings:

- Burro 9 LNG field trial, steady state (DEG1 → DEG2S)
- Burro 9 LNG field trial, transient (DEG1 → DEG2 → DEG3)
- Enid, Oklahoma ammonia example (steady state)

## How EMERGENZ runs it (`server/src/degadis.ts`)

- Each release is modeled as an isothermal, ground-level area source at ambient
  temperature. It is not a cold or flashing two-phase source. The source has a
  1 m primary radius; results change by less than 2 % for radii from 0.5 to 5 m.
- Averaging time is 300 s, ALOHA's toxic-gas averaging time.
- Runs are transient (DEG1 → DEG2 → DEG3). Sort times span the release plus travel
  time, and are refined around the time each level of concern reaches farthest.
- The footprint is the maximum over time of the DEGADIS crosswind profile,
  `b + Sy·sqrt(ln(c/LOC))`, plus the upwind source blanket.
- Run parameters come from `EXAMPLE.ER1/ER2/ER3`. DEG1 stores the source history
  in fixed-size vectors (MAXL = 650). Long releases of gases only slightly denser
  than air can overflow those vectors (TRAP code 5). When that happens, the CRFGER
  thinning criterion is relaxed from 0.008 to 0.016 and then 0.032. In tests this
  changed zone distances by less than 0.3 %. The value used is reported as
  `inputsUsed.sourceVectorErrorCriterion`.
