// tokens-core.test.mjs — verify token conversions + round-trips.
import assert from "node:assert";
import { execSync } from "node:child_process";

execSync("./node_modules/.bin/esbuild src/tokens-core.ts --format=esm --outfile=dist/tokens-core.mjs", { stdio: "inherit" });
const c = await import("../dist/tokens-core.mjs");
const { toHex, fromHex, toKebab, cssVarName, nameToPath, toTokensJSON, toCSSVars, fromTokensJSON } = c;

let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log("  ✓", n); } catch (e) { fail++; console.log("  ✗", n, "\n    ", e.message); } };

console.log("hex:");
t("toHex rose", () => assert.strictEqual(toHex({ r: 0.956, g: 0.247, b: 0.369 }), "#F43F5E"));
t("toHex with alpha", () => assert.strictEqual(toHex({ r: 1, g: 1, b: 1, a: 0.5 }), "#FFFFFF80"));
t("fromHex 6-digit", () => { const c = fromHex("#F43F5E"); assert.ok(Math.abs(c.r - 0.956) < 0.01); });
t("fromHex 3-digit", () => { const c = fromHex("#fff"); assert.strictEqual(c.r, 1); });
t("hex round-trip", () => assert.strictEqual(toHex(fromHex("#0E0F13")), "#0E0F13"));

console.log("naming:");
t("kebab camelCase", () => assert.strictEqual(toKebab("brandAccent"), "brand-accent"));
t("kebab spaces/slashes", () => assert.strictEqual(toKebab("Brand / Accent Hover"), "brand-accent-hover"));
t("path split", () => assert.deepStrictEqual(nameToPath("Brand/Accent"), ["Brand", "Accent"]));
t("cssVarName", () => assert.strictEqual(cssVarName("Brand/Accent"), "--brand-accent"));
t("cssVarName with prefix", () => assert.strictEqual(cssVarName("Accent", "kelo"), "--kelo-accent"));

console.log("StyleSet → tokens JSON:");
const set = {
  colors: [{ name: "Brand/Accent", color: fromHex("#F43F5E") }, { name: "Ink/FG", color: fromHex("#F3F4F6") }],
  text: [{ name: "Body", fontFamily: "Inter", fontStyle: "Regular", fontSize: 16, lineHeight: 24 }],
  spacing: [{ name: "md", value: 16 }],
};
const json = toTokensJSON(set);
t("nested color token", () => assert.strictEqual(json.color.brand.accent.$value, "#F43F5E"));
t("color $type", () => assert.strictEqual(json.color.brand.accent.$type, "color"));
t("typography token", () => assert.strictEqual(json.typography.body.$value.fontSize, "16px"));
t("spacing token", () => assert.strictEqual(json.spacing.md.$value, "16px"));

console.log("StyleSet → CSS vars:");
const css = toCSSVars(set, "kelo");
t("css has --kelo-brand-accent", () => assert.ok(css.includes("--kelo-brand-accent: #F43F5E;"), css));
t("css has spacing var", () => assert.ok(css.includes("16px")));

console.log("round-trip JSON → StyleSet:");
const back = fromTokensJSON(json);
t("round-trips a color", () => {
  const acc = back.colors.find((x) => x.name === "brand/accent");
  assert.ok(acc, "missing"); assert.strictEqual(toHex(acc.color), "#F43F5E");
});
t("round-trips spacing", () => {
  const md = back.spacing.find((x) => x.name === "md");
  assert.strictEqual(md.value, 16);
});
t("round-trips typography size", () => {
  const body = back.text.find((x) => x.name === "body");
  assert.strictEqual(body.fontSize, 16);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
