import assert from "node:assert";
import { execSync } from "node:child_process";
execSync("./node_modules/.bin/esbuild src/data-core.ts --format=esm --outfile=dist/data-core.mjs", { stdio: "inherit" });
const c = await import("../dist/data-core.mjs");
const { generate, detectField, detectSmart, rng } = c;
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); pass++; console.log("  ✓", n); } catch (e) { fail++; console.log("  ✗", n, "\n    ", e.message); } };

console.log("seeded RNG:");
t("same seed → same value", () => assert.strictEqual(generate("fullName", 42), generate("fullName", 42)));
t("different seed → usually differs", () => {
  const vals = new Set(Array.from({ length: 10 }, (_, i) => generate("fullName", i)));
  assert.ok(vals.size > 3);
});

console.log("generators:");
t("email looks like email", () => assert.match(generate("email", 1), /^[a-z.]+@[a-z]+\.com$/));
t("price looks like price", () => assert.match(generate("price", 1), /^\$\d+\.\d{2}$/));
t("percent ends %", () => assert.match(generate("percent", 1), /^\d+%$/));
t("rating is 3.4–5.0", () => { const v = parseFloat(generate("rating", 7)); assert.ok(v >= 3.4 && v <= 5.0, v); });
t("date has month + year", () => assert.match(generate("date", 3), /^[A-Z][a-z]{2} \d{1,2}, 20\d{2}$/));
t("phone has +1", () => assert.match(generate("phone", 3), /^\+1 /));
t("fullName is two words", () => assert.strictEqual(generate("fullName", 5).split(" ").length, 2));
t("sentence ends with period + capital", () => { const s = generate("sentence", 9); assert.ok(/^[A-Z]/.test(s) && s.endsWith(".")); });
t("paragraph has multiple sentences", () => assert.ok(generate("paragraph", 2).split(".").length >= 2));

console.log("field detection:");
t("'Email' → email", () => assert.strictEqual(detectField("Email"), "email"));
t("'First name' → firstName", () => assert.strictEqual(detectField("First name"), "firstName"));
t("'Price' → price", () => assert.strictEqual(detectField("Total price"), "price"));
t("'★ Rating' → rating", () => assert.strictEqual(detectField("Rating"), "rating"));
t("'Bio' → paragraph", () => assert.strictEqual(detectField("Bio"), "paragraph"));
t("smart falls back by length: short → number", () => assert.strictEqual(detectSmart("xyz", 1), "number"));
t("smart falls back by length: long → paragraph", () => assert.strictEqual(detectSmart("xyz", 120), "paragraph"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
