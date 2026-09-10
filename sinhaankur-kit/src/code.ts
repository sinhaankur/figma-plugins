// code.ts — sinhaankur Kit: ONE Figma plugin, many tools. A home menu routes each
// action to a shared, tested core + the Figma API. Modules:
//   • Create UX kit (from colors + font)      → kit-core
//   • Audit (style & a11y)                     → audit-core
//   • Library manager (naming/dupes)           → library-core
//   • Tokens sync (styles ⇄ JSON/CSS)          → tokens-core
//   • Content filler (realistic data)          → data-core
//   • HTML → layers                            → css-core (+ UI DOM walk)
//   • VS Code / dev bridge (export tokens+kit manifest for the repo)
//
// © Ankur Sinha.

import { buildKit, typeScale, colorRoles, DEFAULT_THEME, type KitTheme, type CompSpec } from "./cores/kit-core";
import { auditNodes, summarize, type NodeDesc } from "./cores/audit-core";
import { auditLibrary, summarizeLibrary, proposeStructure, type ComponentDesc } from "./cores/library-core";
import { toTokensJSON, toCSSVars, fromTokensJSON } from "./cores/tokens-core";
import { generate, detectSmart, type FieldType } from "./cores/data-core";
import type { FigmaNode, RGBA } from "./cores/css-core";

figma.showUI(__html__, { width: 480, height: 660, themeColors: true });

figma.ui.onmessage = async (msg: any) => {
  try {
    switch (msg.type) {
      case "create-kit": return createKit(msg.theme);
      case "audit": return runAudit(msg.scope, msg.opts);
      case "audit-library": return runLibraryAudit();
      case "tokens-export": return tokensExport(msg.prefix);
      case "tokens-import": return tokensImport(msg.json);
      case "fill": return fillContent(msg.mode, msg.seed);
      case "html-import": return htmlImport(msg.tree);
      case "select": return selectNode(msg.id);
      case "dev-export": return devExport(msg.prefix);
      case "close": return figma.closePlugin();
    }
  } catch (e: any) {
    figma.ui.postMessage({ type: "error", message: String(e?.message || e) });
  }
};

// ── shared helpers ─────────────────────────────────────────────────────────────
const hexToRGB = (hex: string): RGBA => {
  const h = hex.replace("#", "");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
};
const solid = (c: RGBA): SolidPaint => ({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a });
const loaded = new Set<string>();
async function font(family: string, style: string): Promise<FontName> {
  const f: FontName = { family, style };
  const k = family + style;
  if (loaded.has(k)) return f;
  try { await figma.loadFontAsync(f); loaded.add(k); return f; }
  catch { const fb: FontName = { family: "Inter", style: /bold/i.test(style) ? "Bold" : /medium/i.test(style) ? "Medium" : /semi/i.test(style) ? "Semi Bold" : "Regular" }; try { await figma.loadFontAsync(fb); } catch { fb.style = "Regular"; await figma.loadFontAsync(fb); } return fb; }
}

// ── 1. Create a UX kit from colors + font ──────────────────────────────────────
async function createKit(theme: KitTheme) {
  const t: KitTheme = { ...DEFAULT_THEME, ...theme };
  // color styles
  for (const role of colorRoles(t)) {
    const existing = (await figma.getLocalPaintStylesAsync()).find((s) => s.name === role.name);
    const s = existing || figma.createPaintStyle();
    s.name = role.name; s.paints = [solid(hexToRGB(role.hex))];
  }
  // text styles
  for (const ts of typeScale(16)) {
    const f = await font(t.fontFamily, ts.weight);
    const existing = (await figma.getLocalTextStylesAsync()).find((s) => s.name === `${t.fontFamily}/${ts.name}`);
    const s = existing || figma.createTextStyle();
    s.name = `${t.fontFamily}/${ts.name}`; s.fontName = f; s.fontSize = ts.size;
  }
  // components laid out in a grid
  const specs = buildKit(t);
  const page = figma.createFrame();
  page.name = "sinhaankur Kit — Components";
  page.layoutMode = "HORIZONTAL"; page.layoutWrap = "WRAP";
  page.itemSpacing = 24; page.counterAxisSpacing = 24;
  page.paddingTop = page.paddingBottom = page.paddingLeft = page.paddingRight = 40;
  page.fills = [solid(hexToRGB(t.bg))];
  page.resize(920, 600); page.counterAxisSizingMode = "AUTO"; page.primaryAxisSizingMode = "AUTO";
  page.x = figma.viewport.center.x - 460; page.y = figma.viewport.center.y - 300;

  let made = 0;
  for (const spec of specs) { await buildComponent(spec, t, page); made++; figma.ui.postMessage({ type: "progress", done: made, total: specs.length }); }

  figma.currentPage.selection = [page];
  figma.viewport.scrollAndZoomIntoView([page]);
  figma.notify(`Created ${made} components + ${colorRoles(t).length} color & ${typeScale(16).length} text styles ✨`);
  figma.ui.postMessage({ type: "kit-done", components: made });
}

async function buildComponent(spec: CompSpec, t: KitTheme, parent: FrameNode) {
  const comp = figma.createComponent();
  comp.name = spec.name;
  comp.resize(spec.w, spec.h);
  comp.cornerRadius = spec.radius ?? 0;
  comp.fills = spec.fill && spec.fill !== "transparent" ? [solid(hexToRGB(spec.fill))] : [];
  if (spec.stroke) { comp.strokes = [solid(hexToRGB(spec.stroke))]; comp.strokeWeight = spec.strokeW || 1; }
  // center content w/ auto-layout
  comp.layoutMode = "HORIZONTAL"; comp.primaryAxisAlignItems = "CENTER"; comp.counterAxisAlignItems = "CENTER";
  comp.paddingLeft = comp.paddingRight = spec.pad || 0;
  if (spec.text) {
    const f = await font(t.fontFamily, spec.text.weight);
    const txt = figma.createText(); txt.fontName = f; txt.characters = spec.text.value;
    txt.fontSize = spec.text.size; txt.fills = [solid(hexToRGB(spec.text.color))];
    if (spec.text.align) txt.textAlignHorizontal = spec.text.align;
    comp.appendChild(txt);
  }
  parent.appendChild(comp);
}

// ── 2. Style & a11y audit ──────────────────────────────────────────────────────
function toRGB(p: Paint): RGBA | null { if (p.type !== "SOLID" || p.visible === false) return null; return { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 }; }
function descNode(node: SceneNode): NodeDesc {
  const fills: any[] = [];
  let bound = false;
  if ("fills" in node && node.fills !== figma.mixed) for (const p of node.fills as Paint[]) { const c = toRGB(p); if (c) fills.push(c); }
  if ("fillStyleId" in node && node.fillStyleId) bound = true;
  const d: NodeDesc = { id: node.id, name: node.name, type: node.type, fills, boundColorStyle: bound,
    width: "width" in node ? node.width : undefined, height: "height" in node ? node.height : undefined,
    isInteractive: /\b(button|btn|cta|link|tab|chip|toggle)\b/i.test(node.name) };
  if (node.type === "TEXT") { const tn = node as TextNode; d.fontSize = typeof tn.fontSize === "number" ? tn.fontSize : 16; d.characters = tn.characters; d.bgColor = bgBehind(node); }
  if ("layoutMode" in node && (node as FrameNode).layoutMode !== "NONE") { const f = node as FrameNode; d.paddings = [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft]; d.itemSpacing = f.itemSpacing; }
  return d;
}
function bgBehind(node: SceneNode): RGBA | null { let p: BaseNode | null = node.parent; while (p && "fills" in p) { const f = (p as any).fills; if (Array.isArray(f)) for (const paint of f) { const c = toRGB(paint); if (c) return c; } p = p.parent; } return null; }
function runAudit(scope: string, opts: any) {
  const roots = scope === "selection" && figma.currentPage.selection.length ? figma.currentPage.selection : figma.currentPage.children;
  const descs: NodeDesc[] = []; const visit = (n: SceneNode) => { descs.push(descNode(n)); if ("children" in n) for (const c of n.children) visit(c as SceneNode); };
  for (const r of roots) visit(r as SceneNode);
  const findings = auditNodes(descs, opts);
  figma.ui.postMessage({ type: "audit-result", findings, summary: summarize(findings), scanned: descs.length });
}

// ── 3. Library audit ───────────────────────────────────────────────────────────
async function runLibraryAudit() {
  const comps: ComponentDesc[] = [];
  const walk = (n: SceneNode) => {
    if (n.type === "COMPONENT") comps.push({ id: n.id, name: n.name, isVariant: n.parent?.type === "COMPONENT_SET", setName: n.parent?.type === "COMPONENT_SET" ? (n.parent as ComponentSetNode).name : undefined });
    if (n.type === "COMPONENT_SET") comps.push({ id: n.id, name: n.name, isVariant: false });
    if ("children" in n) for (const c of n.children) walk(c as SceneNode);
  };
  for (const p of figma.currentPage.children) walk(p as SceneNode);
  const issues = auditLibrary(comps);
  figma.ui.postMessage({ type: "library-result", issues, summary: summarizeLibrary(comps, issues), structure: proposeStructure(comps) });
}

// ── 4. Tokens ──────────────────────────────────────────────────────────────────
async function readStyleSet() {
  const colors = []; for (const s of await figma.getLocalPaintStylesAsync()) { const p = s.paints.find((x) => x.type === "SOLID") as SolidPaint | undefined; if (p) colors.push({ name: s.name, color: { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 } }); }
  const text = []; for (const s of await figma.getLocalTextStylesAsync()) text.push({ name: s.name, fontFamily: s.fontName.family, fontStyle: s.fontName.style, fontSize: s.fontSize });
  return { colors, text, spacing: [] as any[] };
}
async function tokensExport(prefix: string) { const set = await readStyleSet(); figma.ui.postMessage({ type: "tokens-result", json: JSON.stringify(toTokensJSON(set as any), null, 2), css: toCSSVars(set as any, prefix), counts: { colors: set.colors.length, text: set.text.length } }); }
async function tokensImport(jsonStr: string) {
  const set = fromTokensJSON(JSON.parse(jsonStr)); const existing = await figma.getLocalPaintStylesAsync(); const byName = new Map(existing.map((s) => [s.name, s]));
  let created = 0, updated = 0;
  for (const c of set.colors) { const paint = solid(c.color as RGBA); const s = byName.get(c.name); if (s) { s.paints = [paint]; updated++; } else { const ns = figma.createPaintStyle(); ns.name = c.name; ns.paints = [paint]; created++; } }
  figma.ui.postMessage({ type: "tokens-imported", created, updated });
}

// ── 5. Content filler ──────────────────────────────────────────────────────────
async function fillContent(mode: string, seed: number) {
  const nodes: TextNode[] = []; const visit = (n: SceneNode) => { if (n.type === "TEXT") nodes.push(n); if ("children" in n) for (const c of n.children) visit(c as SceneNode); };
  for (const n of figma.currentPage.selection) visit(n);
  if (!nodes.length) { figma.notify("Select some text layers first."); return; }
  let filled = 0;
  for (let i = 0; i < nodes.length; i++) { const node = nodes[i]; try { const f = node.fontName; if (f !== figma.mixed) await figma.loadFontAsync(f as FontName); else await figma.loadFontAsync(node.getRangeFontName(0, 1) as FontName); } catch { continue; }
    const type: FieldType = mode === "auto" ? detectSmart(node.name, node.characters.length) : (mode as FieldType);
    node.characters = generate(type, seed + i * 101 + node.name.length); filled++; }
  figma.notify(`Filled ${filled} text layers`); figma.ui.postMessage({ type: "filled", n: filled });
}

// ── 6. HTML import (tree built in the UI) ──────────────────────────────────────
async function htmlImport(tree: FigmaNode) {
  const page = figma.createFrame(); page.name = tree.name || "Imported"; page.resize(Math.max(1, tree.w), Math.max(1, tree.h));
  page.x = figma.viewport.center.x - tree.w / 2; page.y = figma.viewport.center.y - tree.h / 2;
  page.fills = tree.fill ? [solid(tree.fill)] : []; page.clipsContent = true;
  const ox = page.x, oy = page.y;
  const add = async (n: FigmaNode) => {
    if (n.kind === "text" && n.text) { const f = await font(n.fontFamily || "Inter", n.fontStyle || "Regular"); const t = figma.createText(); t.fontName = f; t.characters = n.text; t.fontSize = Math.max(1, n.fontSize || 16); t.x = ox + n.x; t.y = oy + n.y; if (n.color) t.fills = [solid(n.color)]; page.appendChild(t); }
    else { const r = figma.createRectangle(); r.x = ox + n.x; r.y = oy + n.y; r.resize(Math.max(1, n.w), Math.max(1, n.h)); r.fills = n.fill ? [solid(n.fill)] : []; if (n.stroke && n.strokeWidth) { r.strokes = [solid(n.stroke)]; r.strokeWeight = n.strokeWidth; } if (n.radius) r.cornerRadius = n.radius; page.appendChild(r); }
    if (n.children) for (const c of n.children) await add(c);
  };
  for (const c of tree.children || []) await add(c);
  figma.currentPage.selection = [page]; figma.viewport.scrollAndZoomIntoView([page]);
  figma.ui.postMessage({ type: "html-done", count: (tree.children || []).length });
}

// ── 7. VS Code / dev bridge ────────────────────────────────────────────────────
// Export the file's design system as a repo-ready bundle (tokens.json + tokens.css
// + a components manifest) the dev can drop into their codebase / a VS Code task.
async function devExport(prefix: string) {
  const set = await readStyleSet();
  const comps: string[] = [];
  const walk = (n: SceneNode) => { if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") comps.push(n.name); if ("children" in n) for (const c of n.children) walk(c as SceneNode); };
  for (const p of figma.currentPage.children) walk(p as SceneNode);
  figma.ui.postMessage({
    type: "dev-bundle",
    tokensJson: JSON.stringify(toTokensJSON(set as any), null, 2),
    tokensCss: toCSSVars(set as any, prefix),
    components: comps,
  });
}

function selectNode(id: string) { const n = figma.getNodeById(id) as SceneNode | null; if (n && "visible" in n) { figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); } }
