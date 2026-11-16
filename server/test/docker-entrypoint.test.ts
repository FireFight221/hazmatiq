import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testDirectory, "..");
const entrypointPath = path.join(serverRoot, "docker-entrypoint.sh");
const actualTsxPath = path.join(serverRoot, "node_modules/.bin/tsx");
const importerPath = path.join(serverRoot, "src/import-tier2-private.ts");

const facilityCsv = [
  "Facility ID,Facility Name,Company Name,Latitude,Longitude,Street,City,County,State,Zip,Filing Year,NAICS Code,Manned(Y/N)",
  "SYN-001,Synthetic Plant,Synthetic Co,33.5,-86.8,1 Main St,Birmingham,Jefferson,AL,35203,2025,325199,Y",
].join("\n");
const detailCsv = [
  "Facility ID,CASNumber,ChemicalName,MaxDailyQty,AvgDailyQty,MaxAmountInLargestContainer,EHS,Solid,Liquid,Gas,Storage/Pressure/Temperature Types/Location/Max Amount",
  "SYN-001,68476346,Synthetic Chemical,12410,12410,12410,Yes,F,T,F,Above ground tank",
].join("\n");

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function createEntrypointHarness() {
  const root = await mkdtemp(path.join(tmpdir(), "emergenz-entrypoint-test-"));
  const secretRoot = path.join(root, "secrets");
  const inputRoot = path.join(root, "mounted-inputs");
  const runtimeRoot = path.join(root, "runtime");
  const dbPath = path.join(root, "test.db");
  await mkdir(secretRoot, { recursive: true });
  await mkdir(inputRoot, { recursive: true });
  await mkdir(path.join(runtimeRoot, "node_modules/.bin"), { recursive: true });
  await mkdir(path.join(runtimeRoot, "src"), { recursive: true });
  await writeFile(path.join(inputRoot, "facilities.csv"), facilityCsv);
  await writeFile(path.join(inputRoot, "details.csv"), detailCsv);
  await symlink(path.join(inputRoot, "facilities.csv"), path.join(secretRoot, "Tier2-Facilities.csv"));
  await symlink(path.join(inputRoot, "details.csv"), path.join(secretRoot, "Tier2-Details.csv"));

  const entrypoint = (await readFile(entrypointPath, "utf8")).replaceAll("/etc/secrets", secretRoot);
  await writeFile(path.join(runtimeRoot, "docker-entrypoint.sh"), entrypoint, { mode: 0o755 });
  const fakeTsx = [
    "#!/bin/sh",
    'if [ "$1" = "src/import-tier2-private.ts" ]; then',
    "  shift",
    `  exec ${shellQuote(actualTsxPath)} ${shellQuote(importerPath)} "$@"`,
    "fi",
    "exit 0",
    "",
  ].join("\n");
  await writeFile(path.join(runtimeRoot, "node_modules/.bin/tsx"), fakeTsx, { mode: 0o755 });

  const env = {
    ...process.env,
    SQLITE_PATH: dbPath,
    TIER2_PRIVATE_IMPORT_ENABLED: "true",
    TIER2_FACILITY_FILE: path.join(secretRoot, "Tier2-Facilities.csv"),
    TIER2_DETAIL_FILE: path.join(secretRoot, "Tier2-Details.csv"),
    TIER2_EXPECTED_FACILITY_COUNT: "1",
  };
  execFileSync(actualTsxPath, [path.join(serverRoot, "src/init-sqlite.ts")], {
    cwd: serverRoot,
    env,
    stdio: "pipe",
  });

  return { root, runtimeRoot, secretRoot, dbPath, env };
}

async function listStagedDirectories() {
  const entries = await readdir("/tmp");
  return entries.filter((entry) => entry.startsWith("emergenz-tier2."));
}

describe("Docker Tier II startup staging", () => {
  it("imports symlink-mounted synthetic files and exposes linked chemicals to facility search", async () => {
    const harness = await createEntrypointHarness();
    const before = await listStagedDirectories();
    try {
      const result = spawnSync(path.join(harness.runtimeRoot, "docker-entrypoint.sh"), [], {
        cwd: harness.runtimeRoot,
        env: harness.env,
        encoding: "utf8",
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("[tier2] imported 1 facilities, 1 chemical rows");

      const output = execFileSync(process.execPath, [
        "--import", "tsx", "--input-type=module", "-e",
        `import app from ${JSON.stringify(path.join(serverRoot, "src/app.ts"))}; const response = await app.request("/api/facilities?q=Synthetic%20Plant&limit=1"); console.log(JSON.stringify(await response.json()));`,
      ], { cwd: serverRoot, env: harness.env, encoding: "utf8" });
      const body = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? "{}");
      expect(body.coverage).toMatchObject({ tier2Records: 1 });
      expect(body.facilities).toHaveLength(1);
      expect(body.facilities[0]).toMatchObject({ name: "Synthetic Plant" });
      expect(body.facilities[0].chemicals).toHaveLength(1);
      expect(body.facilities[0].chemicals[0]).toMatchObject({ chemicalName: "Synthetic Chemical" });
    } finally {
      expect(await listStagedDirectories()).toEqual(before);
      await rm(harness.root, { recursive: true, force: true });
    }
  });

  it("fails clearly and cleans up when a configured Secret File is missing", async () => {
    const harness = await createEntrypointHarness();
    const before = await listStagedDirectories();
    try {
      await rm(path.join(harness.secretRoot, "Tier2-Details.csv"));
      const result = spawnSync(path.join(harness.runtimeRoot, "docker-entrypoint.sh"), [], {
        cwd: harness.runtimeRoot,
        env: harness.env,
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Tier II detail input is not readable");
      expect(await listStagedDirectories()).toEqual(before);
    } finally {
      await rm(harness.root, { recursive: true, force: true });
    }
  });
});
