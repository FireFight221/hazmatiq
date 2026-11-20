#!/bin/sh
# Builds the EPA DEGADIS 2.1 executables used for heavy-gas dispersion.
# Requires gfortran. Output: server/vendor/degadis/bin/{deg1,deg2s,deg2,deg3}
# Usage: sh server/vendor/degadis/build.sh [--static]
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/bin"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp "$HERE"/src/* "$WORK"/
cd "$WORK"
# The EPA sources include parameter files with mixed-case names.
for p in DEG1 DEG2 DEG3 DEGIN; do
  ln -sf "$p.PRM" "$p.prm"
done
ln -sf DEGIN.PRM DEGin.prm
ln -sf DEGIN.PRM degin.prm
FFLAGS="-std=legacy -fno-automatic -fdec -ffixed-line-length-132 -O1 -w"
LDFLAGS=""
if [ "${1:-}" = "--static" ]; then LDFLAGS="-static"; fi
gfortran -c SHIM.F90 -o shim.o
link() {
  name=$1; shift
  files=""
  for m in "$@"; do files="$files $m.FOR"; done
  # shellcheck disable=SC2086
  gfortran $FFLAGS $LDFLAGS -o "$name" shim.o $files
}
# Module lists follow the EPA make files (make_src.mak, make_ss.mak, make_obs.mak, make_srt.mak).
link deg1  DEG1 AFGEN AFGEN2 ALPH ATMDEF CRFG DATTIM ESTRT1 GAMMA HEAD IO LIMIT NOBL PSIF RIPHIF RKGST RUNNAME SURFAC SZF TPROP TRANS1 TRAP ZBRENT
link deg2s DEG2S AFGEN DATTIM ESTRT2SS GAMMA INCGAMMA LIMIT PSS PSSOUTSS RIPHIF RKGST RUNNAME SERIES SSG SSGOUTSS SSOUT STRT2SS SURFAC TPROP TRAP ZBRENT
link deg2  DEG2 AFGEN AFGEN2 DATTIM ESTRT2 GAMMA INCGAMMA LIMIT OB PSS PSSOUT RIPHIF RKGST RUNNAME SERIES SSG SSGOUT SSSUP STRT2 SURFAC TPROP TRANS2 TRAP TS TUPF UIT ZBRENT
link deg3  DEG3 DATTIM ESTRT3 GAMMA GETTS INCGAMMA LIMIT RKGST RUNNAME SERIES SORTS SORTS1 SRTOUT STRT3 TPROP TRAP TS ZBRENT
mkdir -p "$OUT"
cp deg1 deg2s deg2 deg3 "$OUT"/
echo "DEGADIS executables written to $OUT"
