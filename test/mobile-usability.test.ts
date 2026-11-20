import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`../server/public/${name}`, import.meta.url), "utf8");
const html = read("index.html");
const script = read("script.js");
const css = read("mobile-usability.css");

type Statement = { text: string; items: string[] };
const context: { window: { HazMatChemicalProfileText?: { structureHazardDetail: (value: string) => Statement[] } } } = { window: {} };
runInNewContext(read("chemical-profile-text.js"), context);
const structure = context.window.HazMatChemicalProfileText!.structureHazardDetail;

describe("hazard detail bullets", () => {
  it("splits statements and long lead-in lists without changing wording", () => {
    const source = "Strong acid; reacts violently with bases (e.g. ammonia, amides), strong oxidizers (e.g. chlorates, nitrates), arsenic trioxide, vinyl acetate and nitromethane. Can initiate polymerization in certain alkenes.";
    const result = structure(source);
    expect(result).toEqual([
      { text: "Strong acid", items: [] },
      { text: "reacts violently with", items: ["bases (e.g. ammonia, amides)", "strong oxidizers (e.g. chlorates, nitrates)", "arsenic trioxide", "vinyl acetate and nitromethane."] },
      { text: "Can initiate polymerization in certain alkenes.", items: [] },
    ]);
    const words = (value: string) => value.replace(/[;,]/g, " ").split(/\s+/).filter(Boolean);
    expect(result.flatMap((s) => [s.text, ...s.items]).flatMap(words)).toEqual(words(source));
  });

  it("never lists a sentence that contains an exception clause", () => {
    const source = "May attack concrete, ceramics, some plastics, rubber coatings, leather, and most other materials with the exception of lead, platinum, polyethylene and wax.";
    expect(structure(source)).toEqual([{ text: source, items: [] }]);
  });

  it("keeps chemical names, short lists and abbreviations intact", () => {
    expect(structure("Hydrogen fluoride, anhydrous")).toEqual([{ text: "Hydrogen fluoride, anhydrous", items: [] }]);
    expect(structure("Reacts with 1,2-dichloroethane, e.g. Sodium. Stable.")).toEqual([
      { text: "Reacts with 1,2-dichloroethane, e.g. Sodium.", items: [] },
      { text: "Stable.", items: [] },
    ]);
  });

  it("renders mixing risk and explosion hazards through the bullet list", () => {
    expect(script).toContain("const hazardDetailFields = new Set(['mixing-risk', 'explosion-hazards'");
    expect(script).toContain("value = createHazardDetailList(hazardDetail);");
  });
});

describe("source and value de-duplication", () => {
  it("collapses NIOSH, ERG and CAMEO aliases to one source name", () => {
    expect(script).toContain(".map(canonicalChemicalProfileSource)");
    const start = script.indexOf("const chemicalProfileSourceAliases");
    const end = script.indexOf("function chemicalProfileSources");
    const sandbox: { canonicalChemicalProfileSource?: (label: string) => string } = {};
    runInNewContext(`${script.slice(start, end)}; this.canonicalChemicalProfileSource = canonicalChemicalProfileSource;`, sandbox);
    const canonical = sandbox.canonicalChemicalProfileSource!;
    const labels = ["Chemical Companion", "NIOSH Pocket Guide", "ERG 2024", "NIOSH", "CAMEO Chemicals", "ERG", "NIOSH NPG", "CAMEO"];
    expect([...new Set(labels.map(canonical))]).toEqual(["Chemical Companion", "NIOSH Pocket Guide", "ERG 2024", "CAMEO Chemicals"]);
  });

  it("shows identical profile values once", () => {
    expect(script).toContain("return uniqueProfileText(normalized.filter(hasMeaningfulChemicalProfileData));");
  });
});

describe("phone layout", () => {
  it("loads the mobile layer last and the map options script", () => {
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    expect(sheets.at(-1)).toMatch(/^mobile-usability\.css/);
    expect(html).toContain('<script src="mobile-usability.js?v=1"></script>');
    expect(html).toMatch(/id="plume-map-options-toggle"[^>]*aria-controls="plume-map-controls"/);
    expect(html).toContain('id="plume-map-controls"');
  });

  it("collapses map controls, enlarges inputs and stacks the calculator on phones", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 640px)"));
    expect(phone).toContain(".plume-v2-map-card:not(.map-options-open) .plume-v2-map-controls");
    expect(phone).toMatch(/font-size: 16px !important/);
    expect(phone).toMatch(/min-height: 44px !important/);
    expect(phone).toMatch(/\.plume-release-calc-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\) !important/);
  });

  it("wraps the profile title so the verified chip cannot overlap it", () => {
    expect(css).toMatch(/\.chemical-profile-header-top \{[^}]*flex-wrap: wrap !important/);
  });

  it("does not raise a glyph error for the ERG isolation label", () => {
    expect(script).toMatch(/addOptionalPlumeGuideLayer\(\{\s*id: 'hazmat-erg-isolation-label'/);
  });
});
