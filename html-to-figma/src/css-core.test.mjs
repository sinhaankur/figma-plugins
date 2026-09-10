import assert from "node:assert";
import { execSync } from "node:child_process";
execSync("./node_modules/.bin/esbuild src/css-core.ts --format=esm --outfile=dist/css-core.mjs", { stdio: "inherit" });
const c = await import("../dist/css-core.mjs");
const { parseColor, px, parseRadius, fontStyleName, textAlign, isRenderable, hasVisibleBox } = c;
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log("  ✓", n); } catch (e) { fail++; console.log("  ✗", n, "\n    ", e.message); } };

console.log("color:");
t("rgb → RGBA", () => { const c = parseColor("rgb(244, 63, 94)"); assert.ok(Math.abs(c.r - 0.956) < 0.01 && c.a === 1); });
t("rgba with alpha", () => { const c = parseColor("rgba(0,0,0,0.5)"); assert.strictEqual(c.a, 0.5); });
t("transparent → null", () => assert.strictEqual(parseColor("transparent"), null));
t("rgba alpha 0 → null", () => assert.strictEqual(parseColor("rgba(0,0,0,0)"), null));
t("hex 6 → RGBA", () => { const c = parseColor("#F43F5E"); assert.ok(Math.abs(c.r - 0.956) < 0.01); });
t("hex 3 → RGBA", () => { const c = parseColor("#fff"); assert.strictEqual(c.r, 1); });
t("modern rgb() slash-alpha", () => { const c = parseColor("rgb(255 255 255 / 0.25)"); assert.strictEqual(c.a, 0.25); });

console.log("lengths:");
t("px strips unit", () => assert.strictEqual(px("16px"), 16));
t("radius takes first value", () => assert.strictEqual(parseRadius("8px 8px 0px 0px"), 8));

console.log("font weight → style:");
t("700 → Bold", () => assert.strictEqual(fontStyleName("700", false), "Bold"));
t("400 → Regular", () => assert.strictEqual(fontStyleName("400", false), "Regular"));
t("600 → SemiBold", () => assert.strictEqual(fontStyleName("600", false), "SemiBold"));
t("400 italic → Italic", () => assert.strictEqual(fontStyleName("400", true), "Italic"));
t("700 italic → Bold Italic", () => assert.strictEqual(fontStyleName("700", true), "Bold Italic"));

console.log("text align:");
t("center", () => assert.strictEqual(textAlign("center"), "CENTER"));
t("default → LEFT", () => assert.strictEqual(textAlign("start"), "LEFT"));
t("justify", () => assert.strictEqual(textAlign("justify"), "JUSTIFIED"));

console.log("renderability:");
t("display:none → not renderable", () => assert.strictEqual(isRenderable({ display: "none", visibility: "visible", opacity: "1", width: 10, height: 10 }), false));
t("zero size → not renderable", () => assert.strictEqual(isRenderable({ display: "block", visibility: "visible", opacity: "1", width: 0, height: 10 }), false));
t("visible box → renderable", () => assert.strictEqual(isRenderable({ display: "block", visibility: "visible", opacity: "1", width: 10, height: 10 }), true));
t("hasVisibleBox: bg only", () => assert.strictEqual(hasVisibleBox({ r: 1, g: 1, b: 1, a: 1 }, null, 0), true));
t("hasVisibleBox: nothing", () => assert.strictEqual(hasVisibleBox(null, null, 0), false));

// box-shadow
const { parseBoxShadow } = c;
console.log("box-shadow:");
t("parses offsets+blur", () => { const sh = parseBoxShadow("rgba(0,0,0,0.25) 0px 4px 12px 0px"); assert.strictEqual(sh.y, 4); assert.strictEqual(sh.blur, 12); });
t("none → null", () => assert.strictEqual(parseBoxShadow("none"), null));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
