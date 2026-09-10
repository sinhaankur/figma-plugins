// audit-core.test.mjs — verify the audit logic (esp. WCAG contrast) against known
// values. Run: node --experimental-strip-types src/audit-core.test.mjs
// (or build first). Uses Node's assert; no framework.

import assert from "node:assert";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Compile the TS to a temp mjs with esbuild, then import it.
execSync("./node_modules/.bin/esbuild src/audit-core.ts --format=esm --outfile=dist/audit-core.mjs", { stdio: "inherit" });
const core = await import("../dist/audit-core.mjs");
const { contrastRatio, contrastVerdict, auditNodes, summarize, hex } = core;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log("  ✓", name); } catch (e) { fail++; console.log("  ✗", name, "\n    ", e.message); } }

const white = { r: 1, g: 1, b: 1 };
const black = { r: 0, g: 0, b: 0 };
const rose = { r: 0.956, g: 0.247, b: 0.369 }; // #f43f5e

console.log("WCAG contrast:");
t("black on white = 21:1", () => {
  assert.strictEqual(Math.round(contrastRatio(black, white)), 21);
});
t("white on white = 1:1", () => {
  assert.strictEqual(Math.round(contrastRatio(white, white)), 1);
});
t("rose (#f43f5e) on white ≈ 3.7:1", () => {
  const r = contrastRatio(rose, white);
  assert.ok(r > 3.4 && r < 4.0, `got ${r.toFixed(2)}`);
});
t("verdict: small rose-on-white fails AA (needs 4.5)", () => {
  const v = contrastVerdict(contrastRatio(rose, white), 16, false);
  assert.strictEqual(v.passAA, false);
  assert.strictEqual(v.needed, 4.5);
});
t("verdict: large rose-on-white passes AA (needs 3)", () => {
  const v = contrastVerdict(contrastRatio(rose, white), 28, false);
  assert.strictEqual(v.passAA, true);
});
t("verdict: bold 20px counts as large", () => {
  const v = contrastVerdict(5, 20, true);
  assert.strictEqual(v.large, true);
});

console.log("hex:");
t("rose → #F43F5E", () => assert.strictEqual(hex(rose), "#F43F5E"));

console.log("rules:");
t("low-contrast text → error", () => {
  const f = auditNodes([{ id: "1", name: "t", type: "TEXT", fills: [{ r: .8, g: .8, b: .8 }], boundColorStyle: true, fontSize: 14, bold: false, bgColor: white, characters: "hi" }]);
  assert.ok(f.some((x) => x.rule === "contrast" && x.severity === "error"), JSON.stringify(f));
});
t("good contrast → no contrast error", () => {
  const f = auditNodes([{ id: "1", name: "t", type: "TEXT", fills: [black], boundColorStyle: true, fontSize: 14, bold: false, bgColor: white, characters: "hi" }]);
  assert.ok(!f.some((x) => x.rule === "contrast"));
});
t("hardcoded fill on rect → warn", () => {
  const f = auditNodes([{ id: "2", name: "box", type: "RECTANGLE", fills: [rose], boundColorStyle: false }]);
  assert.ok(f.some((x) => x.rule === "hardcoded-color"));
});
t("bound fill → no hardcoded warn", () => {
  const f = auditNodes([{ id: "2", name: "box", type: "RECTANGLE", fills: [rose], boundColorStyle: true }]);
  assert.ok(!f.some((x) => x.rule === "hardcoded-color"));
});
t("small tap target on interactive → error", () => {
  const f = auditNodes([{ id: "3", name: "btn", type: "FRAME", fills: [], boundColorStyle: true, isInteractive: true, width: 30, height: 30 }]);
  assert.ok(f.some((x) => x.rule === "tap-target"));
});
t("44px tap target → ok", () => {
  const f = auditNodes([{ id: "3", name: "btn", type: "FRAME", fills: [], boundColorStyle: true, isInteractive: true, width: 48, height: 44 }]);
  assert.ok(!f.some((x) => x.rule === "tap-target"));
});
t("off-scale spacing → warn", () => {
  const f = auditNodes([{ id: "4", name: "row", type: "FRAME", fills: [], boundColorStyle: true, itemSpacing: 13 }]);
  assert.ok(f.some((x) => x.rule === "off-scale-spacing"));
});
t("on-scale spacing (16) → ok", () => {
  const f = auditNodes([{ id: "4", name: "row", type: "FRAME", fills: [], boundColorStyle: true, itemSpacing: 16 }]);
  assert.ok(!f.some((x) => x.rule === "off-scale-spacing"));
});
t("detached instance → warn", () => {
  const f = auditNodes([{ id: "5", name: "card", type: "FRAME", fills: [], boundColorStyle: true, isDetachedInstance: true }]);
  assert.ok(f.some((x) => x.rule === "detached-instance"));
});
t("summarize counts severities", () => {
  const f = auditNodes([
    { id: "1", name: "t", type: "TEXT", fills: [{ r: .85, g: .85, b: .85 }], boundColorStyle: true, fontSize: 12, bgColor: white, characters: "x" },
    { id: "2", name: "b", type: "RECTANGLE", fills: [rose], boundColorStyle: false },
  ]);
  const s = summarize(f);
  assert.ok(s.total >= 2 && s.errors >= 1 && s.warnings >= 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
