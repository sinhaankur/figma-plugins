import assert from "node:assert";
import { execSync } from "node:child_process";
execSync("./node_modules/.bin/esbuild src/library-core.ts --format=esm --outfile=dist/library-core.mjs", { stdio: "inherit" });
const c = await import("../dist/library-core.mjs");
const { parseName, toTitleSlug, normKey, editDistance, auditLibrary, proposeStructure, healthScore, summarizeLibrary } = c;
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log("  ✓", n); } catch (e) { fail++; console.log("  ✗", n, "\n    ", e.message); } };

console.log("naming:");
t("parseName groups", () => assert.deepStrictEqual(parseName("Buttons/Primary").path, ["Buttons", "Primary"]));
t("parseName base", () => assert.strictEqual(parseName("Buttons/Primary").base, "Primary"));
t("toTitleSlug camel", () => assert.strictEqual(toTitleSlug("primaryButton"), "Primary Button"));
t("toTitleSlug snake", () => assert.strictEqual(toTitleSlug("primary_button"), "Primary Button"));
t("normKey ignores case/punct", () => assert.strictEqual(normKey("Buttons/Primary!"), "primary"));
t("editDistance", () => assert.strictEqual(editDistance("button", "buton"), 1));

console.log("audit:");
t("default name → error", () => {
  const i = auditLibrary([{ id: "1", name: "Component 3", isVariant: false }]);
  assert.ok(i.some((x) => x.kind === "default-name" && x.severity === "error"));
});
t("ungrouped → warn", () => {
  const i = auditLibrary([{ id: "1", name: "Primary", isVariant: false }]);
  assert.ok(i.some((x) => x.kind === "not-grouped"));
});
t("grouped title-case → no naming error", () => {
  const i = auditLibrary([{ id: "1", name: "Buttons/Primary", isVariant: false }]);
  assert.ok(!i.some((x) => x.kind === "default-name" || x.kind === "not-grouped"));
});
t("duplicate names → warn on both", () => {
  const i = auditLibrary([
    { id: "1", name: "Buttons/Primary", isVariant: false },
    { id: "2", name: "Forms/Primary", isVariant: false },
  ]);
  assert.strictEqual(i.filter((x) => x.kind === "duplicate-name").length, 2);
});
t("near-duplicate detected", () => {
  const i = auditLibrary([
    { id: "1", name: "Cards/Product", isVariant: false },
    { id: "2", name: "Cards/Prodct", isVariant: false },
  ]);
  assert.ok(i.some((x) => x.kind === "near-duplicate"));
});
t("unused → info", () => {
  const i = auditLibrary([{ id: "1", name: "Buttons/Ghost", isVariant: false, usageCount: 0 }]);
  assert.ok(i.some((x) => x.kind === "unused"));
});
t("variants don't trigger duplicate", () => {
  const i = auditLibrary([
    { id: "1", name: "Buttons/Primary", isVariant: false },
    { id: "2", name: "Size=lg", isVariant: true, setName: "Buttons/Primary" },
  ]);
  assert.strictEqual(i.filter((x) => x.kind === "duplicate-name").length, 0);
});

console.log("structure + score:");
t("proposeStructure groups by category", () => {
  const s = proposeStructure([
    { id: "1", name: "Buttons/Primary", isVariant: false },
    { id: "2", name: "Buttons/Ghost", isVariant: false },
    { id: "3", name: "Loose", isVariant: false },
  ]);
  assert.deepStrictEqual(s.Buttons.sort(), ["Ghost", "Primary"]);
  assert.deepStrictEqual(s.Ungrouped, ["Loose"]);
});
t("healthScore: clean lib is high", () => {
  const comps = [{ id: "1", name: "Buttons/Primary", isVariant: false }];
  assert.ok(healthScore(comps, auditLibrary(comps)) >= 90);
});
t("healthScore: messy lib is lower", () => {
  const comps = [{ id: "1", name: "Component 1", isVariant: false }, { id: "2", name: "Frame 2", isVariant: false }];
  assert.ok(healthScore(comps, auditLibrary(comps)) < 80);
});
t("summarize counts", () => {
  const comps = [{ id: "1", name: "Component 1", isVariant: false }, { id: "2", name: "x", isVariant: true }];
  const s = summarizeLibrary(comps, auditLibrary(comps));
  assert.strictEqual(s.components, 1); assert.strictEqual(s.variants, 1); assert.ok(s.errors >= 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
