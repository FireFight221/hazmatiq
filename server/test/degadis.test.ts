import { describe, expect, it } from "vitest";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEGADIS_VENDOR_DIR,
  addCaseVariants,
  buildDegadisInput,
  buildFootprints,
  buildSortTimeParameters,
  degadisAvailable,
  parseDegadisTables,
  runDegadis,
  runProgram,
  tableReach,
  withCrfger,
} from "../src/degadis.js";

const cases = path.join(DEGADIS_VENDOR_DIR, "testcases");

async function runEpaCase(name: string, programs: string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "degadis-epa-"));
  try {
    await copyFile(path.join(cases, `${name}.inp`), path.join(dir, `${name}.inp`));
    for (const k of [1, 2, 3]) await copyFile(path.join(cases, `EXAMPLE.ER${k}`), path.join(dir, `${name}.er${k}`));
    await addCaseVariants(dir, name);
    for (const program of programs) {
      await runProgram(program, dir, name);
      await addCaseVariants(dir, name);
    }
    return await readFile(path.join(dir, `${name}.sr3`), "utf8");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function expectTablesMatch(mine: string, reference: string) {
  const a = parseDegadisTables(mine);
  const b = parseDegadisTables(reference);
  expect(a.length).toBe(b.length);
  expect(a.length).toBeGreaterThan(0);
  a.forEach((table, t) => {
    expect(table.timeSec).toBe(b[t].timeSec);
    expect(table.rows.length).toBe(b[t].rows.length);
    table.rows.forEach((row, r) => {
      const ref = b[t].rows[r];
      for (const key of ["x", "moleFraction", "concentrationKgM3", "halfWidthM", "szM", "syM"] as const) {
        expect(Math.abs(row[key] - ref[key])).toBeLessThanOrEqual(Math.max(1e-6, Math.abs(ref[key]) * 1e-4));
      }
    });
  });
}

describe.skipIf(!degadisAvailable())("EPA DEGADIS 2.1 build reproduces the EPA reference outputs", () => {
  it("Burro 9 LNG field trial, steady state (DEG1 -> DEG2S)", async () => {
    expectTablesMatch(await runEpaCase("b9", ["deg1", "deg2s"]), await readFile(path.join(cases, "b9.lis"), "utf8"));
  }, 60_000);

  it("Burro 9 LNG field trial, time-limited release (DEG1 -> DEG2 -> DEG3)", async () => {
    expectTablesMatch(await runEpaCase("b9t", ["deg1", "deg2", "deg3"]), await readFile(path.join(cases, "b9t.lis"), "utf8"));
  }, 60_000);

  it("Enid, Oklahoma ammonia example, steady state", async () => {
    expectTablesMatch(await runEpaCase("ex3", ["deg1", "deg2s"]), await readFile(path.join(cases, "ex3.lis"), "utf8"));
  }, 60_000);
});

describe("DEGADIS adapter", () => {
  it("writes the input file in the IO.FOR read order for an isothermal release", () => {
    const text = buildDegadisInput({
      releaseRateKgPerSec: 1, releaseDurationSec: 600, molecularWeight: 70.906, ambientTempC: 10,
      windSpeed10mMps: 2, stabilityClass: "F", roughnessM: 0.03,
      levels: [{ key: "AEGL-3", ppm: 20 }, { key: "AEGL-1", ppm: 0.5 }], maxRangeM: 10000, gasName: "Chlorine",
    });
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(28);
    expect(lines[4]).toBe("2.000000000 10.0 0.03000000000");
    expect(lines[5]).toBe("6");
    expect(lines[6]).toBe("0.0 300.0000000");
    expect(lines[9]).toBe("1 283.1500000");
    expect(lines[12]).toBe("CHL");
    expect(lines[15]).toBe("0.00002000000000 2.500000000e-7 0.0");
    expect(lines[26]).toBe(" F");
  });

  it("puts ER3 sort-time values in columns 11-20", () => {
    const er3 = "ERT1       20.       FIRST\nERDT       5.        DELTA\nERNTIM     20.       N\nCHECK5       0.       USE THE DEFAULT TIME PARAMETERS\n";
    const text = buildSortTimeParameters(er3, 328, 328, 40);
    expect(text.split("\n")[0].slice(10, 20).trim()).toBe("328.");
    expect(text.split("\n")[2].slice(10, 20).trim()).toBe("40.");
    expect(text).toMatch(/^CHECK5\s+1\./m);
  });

  it("rewrites only the CRFGER value in the ER1 file, keeping columns 11-20", async () => {
    const er1 = await readFile(path.join(cases, "EXAMPLE.ER1"), "utf8");
    const changed = withCrfger(er1, 0.016);
    const line = changed.split("\n").find((entry) => /^crfger/i.test(entry))!;
    expect(line.slice(10, 20).trim()).toBe("0.016");
    expect(changed.split("\n").filter((entry, index) => entry !== er1.split("\n")[index])).toHaveLength(1);
  });

  it("finds the level-of-concern distance by log-linear interpolation", () => {
    const rows = [
      { x: 10, moleFraction: 1e-3, concentrationKgM3: 0, halfWidthM: 5, szM: 1, syM: 0 },
      { x: 100, moleFraction: 1e-5, concentrationKgM3: 0, halfWidthM: 5, szM: 1, syM: 2 },
    ];
    expect(tableReach(rows, 1e-4)).toBeCloseTo(55, 6);
  });

  it("uses the DEGADIS crosswind profile: half-width = b + Sy sqrt(ln(c/LOC))", () => {
    // DEG2S printed a 291 m half-width to 5e-7 at x = 1107 m (c = 3.354e-5, b = 81.5 m, Sy = 102 m) for 1 kg/s chlorine, F, 2 m/s.
    const table = { timeSec: null, rows: [
      { x: 11, moleFraction: 0.4, concentrationKgM3: 0, halfWidthM: 8.7, szM: 0.1, syM: 0 },
      { x: 1107, moleFraction: 3.354e-5, concentrationKgM3: 0, halfWidthM: 81.5, szM: 16, syM: 102 },
      { x: 30000, moleFraction: 1e-7, concentrationKgM3: 0, halfWidthM: 0, szM: 100, syM: 600 },
    ] };
    const [footprint] = buildFootprints([table], [{ key: "x", ppm: 0.5 }], 100000, false);
    const expected = 81.5 + 102 * Math.sqrt(Math.log(3.354e-5 / 5e-7));
    expect(expected).toBeCloseTo(291, 0);
    expect(footprint.maxCrosswindM).toBeGreaterThanOrEqual(expected - 1);
    expect(footprint.polygon[0][0]).toBeLessThan(0); // the dense-gas blanket extends upwind
  });
});

describe.skipIf(!degadisAvailable())("DEGADIS heavy-gas runs", () => {
  const chlorine = {
    molecularWeight: 70.906, ambientTempC: 10, roughnessM: 0.03, maxRangeM: 10000, gasName: "Chlorine",
    levels: [{ key: "AEGL-3", ppm: 20 }, { key: "AEGL-2", ppm: 2 }, { key: "AEGL-1", ppm: 0.5 }],
  };

  it("orders chlorine threat zones and agrees with the steady-state run for a one-hour release", async () => {
    const result = await runDegadis({ ...chlorine, releaseRateKgPerSec: 1, releaseDurationSec: 3600, windSpeed10mMps: 2, stabilityClass: "F" });
    const [a3, a2, a1] = result.footprints;
    expect(a3.maxDownwindM).toBeLessThan(a2.maxDownwindM);
    expect(a2.maxDownwindM).toBeLessThanOrEqual(a1.maxDownwindM);
    // DEG2S steady state for this case: AEGL-3 1507 m, AEGL-2 8187 m.
    expect(a3.maxDownwindM).toBeGreaterThan(1507 * 0.9);
    expect(a3.maxDownwindM).toBeLessThan(1507 * 1.15);
    expect(a2.maxDownwindM).toBeGreaterThan(8187 * 0.9);
    expect(a2.maxDownwindM).toBeLessThan(8187 * 1.1);
    expect(result.frictionVelocityMps).toBeCloseTo(0.0769, 3);
    expect(result.sourceBlanketRadiusM).toBeGreaterThan(5);
  }, 60_000);

  it("completes a long release of a gas only slightly denser than air (source-vector overflow retry)", async () => {
    const result = await runDegadis({
      releaseRateKgPerSec: 1,
      releaseDurationSec: 3600,
      molecularWeight: 32.05, // hydrazine vapour, density ratio about 1.1
      ambientTempC: 20,
      windSpeed10mMps: 3,
      stabilityClass: "D",
      roughnessM: 0.03,
      levels: [{ key: "AEGL-3", ppm: 35 }, { key: "AEGL-2", ppm: 13 }],
      maxRangeM: 10000,
      gasName: "Hydrazine",
      title: "Hydrazine 302-01-2",
    });
    expect(result.inputsUsed.sourceVectorErrorCriterion).toBeGreaterThan(0.008);
    const [aegl3, aegl2] = result.footprints;
    expect(aegl3.maxDownwindM).toBeGreaterThan(500);
    expect(aegl2.maxDownwindM).toBeGreaterThan(aegl3.maxDownwindM);
  }, 60_000);

  it("gives shorter zones for a shorter release of the same rate", async () => {
    const long = await runDegadis({ ...chlorine, releaseRateKgPerSec: 1, releaseDurationSec: 3600, windSpeed10mMps: 2, stabilityClass: "F" });
    const short = await runDegadis({ ...chlorine, releaseRateKgPerSec: 1, releaseDurationSec: 600, windSpeed10mMps: 2, stabilityClass: "F" });
    expect(short.footprints[1].maxDownwindM).toBeLessThan(long.footprints[1].maxDownwindM * 0.8);
  }, 60_000);
});
