"use strict";
(() => {
  // src/tokens-core.ts
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

  // src/code.ts
  figma.showUI(__html__, { width: 420, height: 580, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "close") return figma.closePlugin();
    if (msg.type === "export") return doExport(msg.prefix);
    if (msg.type === "import") return doImport(msg.json);
  };
  async function readStyleSet() {
    const colors = [];
    for (const s of await figma.getLocalPaintStylesAsync()) {
      const paint = s.paints.find((p) => p.type === "SOLID");
      if (!paint) continue;
      const c = paint.color;
      const rgba = { r: c.r, g: c.g, b: c.b, a: paint.opacity };
      colors.push({ name: s.name, color: rgba });
    }
    const text = [];
    for (const s of await figma.getLocalTextStylesAsync()) {
      text.push({
        name: s.name,
        fontFamily: s.fontName.family,
        fontStyle: s.fontName.style,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight && s.lineHeight.unit === "PIXELS" ? s.lineHeight.value : void 0,
        letterSpacing: s.letterSpacing && s.letterSpacing.unit === "PIXELS" ? s.letterSpacing.value : void 0
      });
    }
    const spacing = await readSpacingVars();
    return { colors, text, spacing };
  }
  async function readSpacingVars() {
    const out = [];
    try {
      const vars = await figma.variables.getLocalVariablesAsync("FLOAT");
      for (const v of vars) {
        if (!/spac|gap|size/i.test(v.name)) continue;
        const modeId = Object.keys(v.valuesByMode)[0];
        const val = v.valuesByMode[modeId];
        if (typeof val === "number") out.push({ name: v.name.replace(/^spacing\//i, ""), value: val });
      }
    } catch {
    }
    return out;
  }
  async function doExport(prefix) {
    const set = await readStyleSet();
    const json = JSON.stringify(toTokensJSON(set), null, 2);
    const css = toCSSVars(set, prefix);
    figma.ui.postMessage({
      type: "exported",
      json,
      css,
      counts: { colors: set.colors.length, text: set.text.length, spacing: set.spacing.length }
    });
  }
  async function doImport(jsonStr) {
    var _a;
    let set;
    try {
      set = fromTokensJSON(JSON.parse(jsonStr));
    } catch (e) {
      figma.ui.postMessage({ type: "import-error", message: "Invalid JSON: " + ((e == null ? void 0 : e.message) || e) });
      return;
    }
    const existing = await figma.getLocalPaintStylesAsync();
    const byName = new Map(existing.map((s) => [s.name, s]));
    let created = 0, updated = 0;
    for (const c of set.colors) {
      const paint = { type: "SOLID", color: { r: c.color.r, g: c.color.g, b: c.color.b }, opacity: (_a = c.color.a) != null ? _a : 1 };
      let style = byName.get(c.name);
      if (style) {
        style.paints = [paint];
        updated++;
      } else {
        style = figma.createPaintStyle();
        style.name = c.name;
        style.paints = [paint];
        created++;
      }
    }
    figma.ui.postMessage({ type: "imported", created, updated });
    figma.notify(`Tokens applied \u2014 ${created} created, ${updated} updated`);
  }
})();
