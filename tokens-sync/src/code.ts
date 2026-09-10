// code.ts — Figma sandbox for Tokens Sync. Reads the file's color & text styles
// (and optional spacing collected from a naming convention), converts via the
// tested tokens-core, and hands JSON/CSS to the UI. On re-import, creates/updates
// color styles from a tokens JSON so Figma and your codebase stay in sync.
//
// © Ankur Sinha.

import {
  toTokensJSON, toCSSVars, fromTokensJSON,
  type StyleSet, type ColorStyle, type TypeStyle, type RGBA,
} from "./tokens-core";

figma.showUI(__html__, { width: 420, height: 580, themeColors: true });

type UIMsg =
  | { type: "export"; prefix: string }
  | { type: "import"; json: string }
  | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "close") return figma.closePlugin();
  if (msg.type === "export") return doExport(msg.prefix);
  if (msg.type === "import") return doImport(msg.json);
};

async function readStyleSet(): Promise<StyleSet> {
  const colors: ColorStyle[] = [];
  for (const s of await figma.getLocalPaintStylesAsync()) {
    const paint = s.paints.find((p) => p.type === "SOLID") as SolidPaint | undefined;
    if (!paint) continue;
    const c = paint.color;
    const rgba: RGBA = { r: c.r, g: c.g, b: c.b, a: paint.opacity };
    colors.push({ name: s.name, color: rgba });
  }
  const text: TypeStyle[] = [];
  for (const s of await figma.getLocalTextStylesAsync()) {
    text.push({
      name: s.name,
      fontFamily: s.fontName.family,
      fontStyle: s.fontName.style,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight && s.lineHeight.unit === "PIXELS" ? s.lineHeight.value : undefined,
      letterSpacing: s.letterSpacing && s.letterSpacing.unit === "PIXELS" ? s.letterSpacing.value : undefined,
    });
  }
  // spacing: Figma has no native spacing styles; harvest from variables named like
  // "spacing/*" if a variable collection exists, else leave empty.
  const spacing = await readSpacingVars();
  return { colors, text, spacing };
}

async function readSpacingVars(): Promise<{ name: string; value: number }[]> {
  const out: { name: string; value: number }[] = [];
  try {
    const vars = await figma.variables.getLocalVariablesAsync("FLOAT");
    for (const v of vars) {
      if (!/spac|gap|size/i.test(v.name)) continue;
      const modeId = Object.keys(v.valuesByMode)[0];
      const val = v.valuesByMode[modeId];
      if (typeof val === "number") out.push({ name: v.name.replace(/^spacing\//i, ""), value: val });
    }
  } catch { /* variables API may be unavailable */ }
  return out;
}

async function doExport(prefix: string) {
  const set = await readStyleSet();
  const json = JSON.stringify(toTokensJSON(set), null, 2);
  const css = toCSSVars(set, prefix);
  figma.ui.postMessage({
    type: "exported", json, css,
    counts: { colors: set.colors.length, text: set.text.length, spacing: set.spacing.length },
  });
}

async function doImport(jsonStr: string) {
  let set: StyleSet;
  try { set = fromTokensJSON(JSON.parse(jsonStr)); }
  catch (e: any) { figma.ui.postMessage({ type: "import-error", message: "Invalid JSON: " + (e?.message || e) }); return; }

  const existing = await figma.getLocalPaintStylesAsync();
  const byName = new Map(existing.map((s) => [s.name, s]));
  let created = 0, updated = 0;
  for (const c of set.colors) {
    const paint: SolidPaint = { type: "SOLID", color: { r: c.color.r, g: c.color.g, b: c.color.b }, opacity: c.color.a ?? 1 };
    let style = byName.get(c.name);
    if (style) { style.paints = [paint]; updated++; }
    else { style = figma.createPaintStyle(); style.name = c.name; style.paints = [paint]; created++; }
  }
  figma.ui.postMessage({ type: "imported", created, updated });
  figma.notify(`Tokens applied — ${created} created, ${updated} updated`);
}
