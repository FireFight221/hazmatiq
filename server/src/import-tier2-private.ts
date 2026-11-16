import { access, lstat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "./db.js";
import * as schema from "./schema.js";
import { clearTier2DetailsForSource, importTier2Details, parseTier2DetailsFile } from "./tier2/details.js";
import { importTier2Facilities, parseTier2FacilityFile } from "./tier2/importer.js";

export type PrivateTier2ImportOptions = {
  facilityFile: string;
  detailFile: string;
  state?: string;
  expectedFacilityCount?: number;
};

async function resolvedPath(input: string): Promise<string> {
  if (path.isAbsolute(input)) return input;
  const candidates = [path.resolve(process.cwd(), input), path.resolve(process.cwd(), "..", input)];
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.F_OK);
      return candidate;
    } catch {
      // npm --prefix runs the server script from server/; also support repo-root paths.
    }
  }
  return candidates[0];
}

/**
 * Tier II exports contain sensitive facility and inventory data. Only load a
 * regular, non-symlink file with no group/other permissions. This protects
 * local imports and Render Secret Files before any CSV bytes are parsed.
 */
export async function assertPrivateTier2Input(filePath: string, label: string): Promise<string> {
  const resolved = await resolvedPath(filePath);
  const file = await lstat(resolved);
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file, not a symlink`);
  }
  if ((file.mode & 0o077) !== 0) {
    throw new Error(`${label} must be owner-readable only (mode 0600 or 0400)`);
  }
  await access(resolved, fsConstants.R_OK);
  return resolved;
}

export async function importPrivateTier2(options: PrivateTier2ImportOptions) {
  const facilityFile = await assertPrivateTier2Input(options.facilityFile, "Tier II facility input");
  const detailFile = await assertPrivateTier2Input(options.detailFile, "Tier II detail input");
  const facilityResult = await parseTier2FacilityFile(facilityFile, options.state ?? "");

  if (!facilityResult.records.length) {
    throw new Error("Tier II facility input produced zero records; no database changes were made");
  }
  if (options.expectedFacilityCount != null && facilityResult.records.length !== options.expectedFacilityCount) {
    throw new Error(`Tier II facility count did not match the configured expectation; no database changes were made`);
  }

  const db = getDb();
  await importTier2Facilities(db, facilityResult.records);
  const detailResult = await parseTier2DetailsFile(detailFile, db);
  const sourceFacilityIds = facilityResult.records.map((record) => record.sourceFacilityId);
  await clearTier2DetailsForSource(db, sourceFacilityIds);
  const detailCounts = await importTier2Details(db, detailResult);

  await db.insert(schema.dataSources).values({
    key: "tier2",
    edition: process.env.TIER2_IMPORT_EDITION?.trim() || "authorized-private-import",
    license: "Authorized private import",
    recordCount: facilityResult.records.length,
  }).onConflictDoUpdate({
    target: schema.dataSources.key,
    set: {
      edition: process.env.TIER2_IMPORT_EDITION?.trim() || "authorized-private-import",
      license: "Authorized private import",
      recordCount: facilityResult.records.length,
      updatedAt: sql`(datetime('now'))`,
    },
  });

  return {
    facilityReport: facilityResult.report,
    detailReport: detailResult.report,
    importedFacilities: facilityResult.records.length,
    ...detailCounts,
  };
}

function argumentValue(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? "" : "";
}

function optionalCount(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("expected facility count must be a positive integer");
  return parsed;
}

const args = process.argv.slice(2);
const facilityFile = argumentValue(args, "--facility-file") || process.env.TIER2_FACILITY_FILE || "";
const detailFile = argumentValue(args, "--detail-file") || process.env.TIER2_DETAIL_FILE || "";
const state = argumentValue(args, "--state") || process.env.TIER2_IMPORT_STATE || "";
const expectedFacilityCount = optionalCount(argumentValue(args, "--expected-facilities") || process.env.TIER2_EXPECTED_FACILITY_COUNT || "");

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!facilityFile || !detailFile) {
    console.error("Usage: npm run import:tier2-private -- --facility-file <path> --detail-file <path> [--state AL] [--expected-facilities N]");
    process.exitCode = 1;
  } else {
    try {
      const result = await importPrivateTier2({ facilityFile, detailFile, state, expectedFacilityCount });
      console.log(`[tier2] imported ${result.importedFacilities} facilities, ${result.chemicals} chemical rows, ${result.contacts} contact rows`);
      if (result.facilityReport.errors.length) console.log(`[tier2] validation notes: ${result.facilityReport.errors.length}`);
      if (result.detailReport.unmatchedFacilities || result.detailReport.errors.length) {
        console.log(`[tier2] detail validation notes: ${result.detailReport.unmatchedFacilities + result.detailReport.errors.length}`);
      }
    } catch (error) {
      console.error(`[tier2] private import failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}
