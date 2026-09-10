function toHex({ r, g, b, a }) {
  const h = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  const base = `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
  return a != null && a < 1 ? base + h(a) : base;
}
function fromHex(hex) {
  const s = hex.replace(/^#/, "");
  const n = (i) => parseInt(s.slice(i, i + 2), 16) / 255;
  if (s.length === 3) {
    const d = (i) => parseInt(s[i] + s[i], 16) / 255;
    return { r: d(0), g: d(1), b: d(2) };
  }
  const rgba = { r: n(0), g: n(2), b: n(4) };
  if (s.length === 8) rgba.a = n(6);
  return rgba;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function nameToPath(name) {
  return name.split("/").map((s) => s.trim()).filter(Boolean);
}
function toKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_/]+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function cssVarName(name, prefix = "") {
  const path = nameToPath(name).map(toKebab).filter(Boolean).join("-");
  return `--${prefix ? toKebab(prefix) + "-" : ""}${path}`;
}
function setDeep(root, path, leaf) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = toKebab(path[i]) || path[i];
    cur[key] = cur[key] || {};
    cur = cur[key];
  }
  cur[toKebab(path[path.length - 1]) || path[path.length - 1]] = leaf;
}
function toTokensJSON(set) {
  const out = { color: {}, typography: {}, spacing: {} };
  for (const c of set.colors) setDeep(out.color, nameToPath(c.name), { $value: toHex(c.color), $type: "color" });
  for (const t of set.text) {
    setDeep(out.typography, nameToPath(t.name), {
      $type: "typography",
      $value: {
        fontFamily: t.fontFamily,
        fontWeight: t.fontStyle,
        fontSize: `${t.fontSize}px`,
        ...t.lineHeight ? { lineHeight: `${t.lineHeight}px` } : {},
        ...t.letterSpacing ? { letterSpacing: `${t.letterSpacing}px` } : {}
      }
    });
  }
  for (const s of set.spacing) setDeep(out.spacing, nameToPath(s.name), { $value: `${s.value}px`, $type: "dimension" });
  return out;
}
function toCSSVars(set, prefix = "") {
  const lines = [":root {"];
  for (const c of set.colors) lines.push(`  ${cssVarName(c.name, prefix)}: ${toHex(c.color)};`);
  for (const s of set.spacing) lines.push(`  ${cssVarName("space/" + s.name, prefix)}: ${s.value}px;`);
  for (const t of set.text) {
    const base = cssVarName("text/" + t.name, prefix);
    lines.push(`  ${base}-size: ${t.fontSize}px;`);
    lines.push(`  ${base}-family: ${t.fontFamily};`);
    if (t.lineHeight) lines.push(`  ${base}-line: ${t.lineHeight}px;`);
  }
  lines.push("}");
  return lines.join("\n");
}
function fromTokensJSON(json) {
  const set = { colors: [], text: [], spacing: [] };
  const walk = (obj, path, kind) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && "$value" in v) {
        const name = [...path, k].join("/");
        if (kind === "color") set.colors.push({ name, color: fromHex(String(v.$value)) });
        else if (kind === "spacing") set.spacing.push({ name, value: parsePx(String(v.$value)) });
        else if (kind === "typography") {
          const val = v.$value || {};
          set.text.push({
            name,
            fontFamily: val.fontFamily || "Inter",
            fontStyle: val.fontWeight || "Regular",
            fontSize: parsePx(val.fontSize || "16"),
            lineHeight: val.lineHeight ? parsePx(val.lineHeight) : void 0,
            letterSpacing: val.letterSpacing ? parsePx(val.letterSpacing) : void 0
          });
        }
      } else if (v && typeof v === "object") {
        walk(v, [...path, k], kind);
      }
    }
  };
  if (json.color) walk(json.color, [], "color");
  if (json.spacing) walk(json.spacing, [], "spacing");
  if (json.typography) walk(json.typography, [], "typography");
  return set;
}
function parsePx(v) {
  return typeof v === "number" ? v : parseFloat(String(v).replace("px", "")) || 0;
}
export {
  cssVarName,
  fromHex,
  fromTokensJSON,
  nameToPath,
  toCSSVars,
  toHex,
  toKebab,
  toTokensJSON
};
