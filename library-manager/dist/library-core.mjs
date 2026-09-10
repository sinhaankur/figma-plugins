const DEFAULT_RE = /^(component|frame|group|rectangle|ellipse)\s*\d*$/i;
function parseName(name) {
  const clean = name.split(",")[0].replace(/\s*\w+=\S+.*/g, name.includes("=") ? "" : name);
  const parts = (name.includes("=") ? name.split("=")[0] : name).split("/").map((s) => s.trim()).filter(Boolean);
  return { path: parts, base: parts[parts.length - 1] || name };
}
function toTitleSlug(s) {
  return s.trim().replace(/[_\s]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function normKey(name) {
  return parseName(name).base.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function auditLibrary(components) {
  const issues = [];
  const add = (c, kind, severity, message, suggestion) => issues.push({ id: c.id, name: c.name, kind, severity, message, suggestion });
  const tops = components.filter((c) => !c.isVariant);
  const byKey = /* @__PURE__ */ new Map();
  for (const c of tops) {
    const k = normKey(c.name);
    byKey.set(k, [...byKey.get(k) || [], c]);
  }
  for (const c of tops) {
    const { path, base } = parseName(c.name);
    if (!c.name.trim()) {
      add(c, "unnamed", "error", "Component has no name.", "Give it a Category/Name.");
      continue;
    }
    if (DEFAULT_RE.test(base)) add(c, "default-name", "error", `Default name "${base}".`, `Rename, e.g. Buttons/${toTitleSlug(base)}`);
    if (path.length < 2) add(c, "not-grouped", "warn", `"${base}" isn't grouped.`, `Use a Category/Name, e.g. Buttons/${toTitleSlug(base)}`);
    if (base !== toTitleSlug(base) && !c.name.includes("=")) add(c, "inconsistent-case", "info", `"${base}" isn't Title Case.`, `Rename to "${toTitleSlug(base)}"`);
    if (c.usageCount === 0) add(c, "unused", "info", `"${base}" has 0 instances.`, "Consider archiving if unused.");
  }
  for (const [, group] of byKey) {
    if (group.length > 1) {
      for (const c of group) add(
        c,
        "duplicate-name",
        "warn",
        `Duplicate name shared by ${group.length} components.`,
        "Merge or disambiguate the names."
      );
    }
  }
  const bases = tops.map((c) => ({ c, k: normKey(c.name) }));
  for (let i = 0; i < bases.length; i++)
    for (let j = i + 1; j < bases.length; j++) {
      if (bases[i].k === bases[j].k) continue;
      const d = editDistance(bases[i].k, bases[j].k);
      if (d > 0 && d <= 2 && Math.max(bases[i].k.length, bases[j].k.length) >= 4) {
        add(
          bases[i].c,
          "near-duplicate",
          "info",
          `Very similar to "${parseName(bases[j].c.name).base}" \u2014 possible duplicate.`
        );
      }
    }
  return issues;
}
function proposeStructure(components) {
  const tree = {};
  for (const c of components.filter((x) => !x.isVariant)) {
    const { path, base } = parseName(c.name);
    const cat = path.length >= 2 ? path[0] : "Ungrouped";
    tree[cat] = tree[cat] || [];
    if (!tree[cat].includes(base)) tree[cat].push(base);
  }
  for (const k of Object.keys(tree)) tree[k].sort();
  return tree;
}
function healthScore(components, issues) {
  const tops = components.filter((c) => !c.isVariant).length || 1;
  const weight = { error: 3, warn: 1.5, info: 0.5 };
  const penalty = issues.reduce((s, i) => s + weight[i.severity], 0);
  return Math.max(0, Math.round(100 - penalty / tops * 20));
}
function summarizeLibrary(components, issues) {
  const tops = components.filter((c) => !c.isVariant).length;
  const variants = components.filter((c) => c.isVariant).length;
  const by = (s) => issues.filter((i) => i.severity === s).length;
  return {
    components: tops,
    variants,
    errors: by("error"),
    warnings: by("warn"),
    info: by("info"),
    score: healthScore(components, issues)
  };
}
export {
  auditLibrary,
  editDistance,
  healthScore,
  normKey,
  parseName,
  proposeStructure,
  summarizeLibrary,
  toTitleSlug
};
