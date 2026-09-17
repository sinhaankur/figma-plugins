// code.ts — Figma sandbox for Component Manager.
//
// Two jobs:
//   1) AUDIT — read every component / component-set in the file, run the pure
//      library-core audit (naming, duplicates, grouping, health score) and send the
//      result to the UI. Selecting an issue selects that component on the canvas.
//   2) GENERATE KIT — from the user's theme (colors + font + radius), build real
//      Figma components (buttons, inputs, card, badge…) plus paint + text styles,
//      laid out on a fresh section, using the pure kit-core spec.
//
// All heavy logic lives in the tested *-core.ts; this file only talks to Figma.
// © Ankur Sinha.

import {
  auditLibrary, summarizeLibrary, proposeStructure, type ComponentDesc, type LibraryIssue,
} from "./library-core";
import {
  buildKit, typeScale, colorRoles, DEFAULT_THEME, type KitTheme, type CompSpec,
} from "./kit-core";

figma.showUI(__html__, { width: 460, height: 640, themeColors: true });

type UIMsg =
  | { type: "audit" }
  | { type: "select"; id: string }
  | { type: "generate"; theme: KitTheme }
  | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  try {
    if (msg.type === "close") return figma.closePlugin();
    if (msg.type === "audit") return runAudit();
    if (msg.type === "select") return selectNode(msg.id);
    if (msg.type === "generate") return generateKit(msg.theme);
  } catch (e: any) {
    figma.notify("Error: " + (e && e.message ? e.message : String(e)));
    figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) });
  }
};

// ── 1) AUDIT ────────────────────────────────────────────────────────────────
function collectComponents(): ComponentDesc[] {
  const out: ComponentDesc[] = [];
  const comps = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
  for (const node of comps) {
    if (node.type === "COMPONENT_SET") {
      out.push({ id: node.id, name: node.name, isVariant: false,
        width: node.width, height: node.height });
    } else if (node.type === "COMPONENT") {
      const set = node.parent && node.parent.type === "COMPONENT_SET" ? node.parent : null;
      out.push({ id: node.id, name: set ? set.name : node.name, isVariant: !!set,
        setName: set ? set.name : undefined, width: node.width, height: node.height });
    }
  }
  return out;
}

function runAudit() {
  const components = collectComponents();
  const issues = auditLibrary(components);
  const summary = summarizeLibrary(components, issues);
  const structure = proposeStructure(components);
  figma.ui.postMessage({ type: "audit-result", summary, issues, structure });
  if (components.length === 0) figma.notify("No components found in this file.");
}

async function selectNode(id: string) {
  const node = await figma.getNodeByIdAsync(id);
  if (node && "type" in node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }
}

// ── 2) GENERATE KIT ───────────────────────────────────────────────────────────
function hexToRGB(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace("#", "");
  let a = 1;
  if (h.length === 8) { a = parseInt(h.slice(6, 8), 16) / 255; h = h.slice(0, 6); }
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a };
}
const paint = (hex: string): SolidPaint => {
  const c = hexToRGB(hex);
  return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
};

const fontsLoaded = new Set<string>();
async function loadFont(family: string, style: string): Promise<FontName> {
  const key = family + "__" + style;
  const f: FontName = { family, style };
  if (fontsLoaded.has(key)) return f;
  try { await figma.loadFontAsync(f); fontsLoaded.add(key); return f; }
  catch {
    let fb: FontName = { family: "Inter", style };
    try { await figma.loadFontAsync(fb); } catch { fb = { family: "Inter", style: "Regular" }; await figma.loadFontAsync(fb); }
    fontsLoaded.add("Inter__" + fb.style);
    return fb;
  }
}

async function buildComponent(spec: CompSpec, family: string): Promise<ComponentNode> {
  const comp = figma.createComponent();
  comp.name = spec.name;
  comp.resize(spec.w, spec.h);
  comp.cornerRadius = spec.radius ?? 0;
  comp.fills = spec.fill && spec.fill !== "transparent" ? [paint(spec.fill)] : [];
  if (spec.stroke && spec.strokeW) { comp.strokes = [paint(spec.stroke)]; comp.strokeWeight = spec.strokeW; }

  if (spec.text) {
    const font = await loadFont(family, spec.text.weight);
    const t = figma.createText();
    t.fontName = font;
    t.characters = spec.text.value;
    t.fontSize = spec.text.size;
    t.fills = [paint(spec.text.color)];
    t.textAlignVertical = "CENTER";
    t.textAlignHorizontal = spec.text.align === "CENTER" ? "CENTER" : "LEFT";
    const pad = spec.pad ?? 12;
    t.resize(Math.max(1, spec.w - pad * 2), spec.h);
    t.x = pad; t.y = 0;
    t.textAutoResize = "NONE";
    comp.appendChild(t);
  }
  return comp;
}

async function generateKit(themeIn: KitTheme) {
  const theme = { ...DEFAULT_THEME, ...themeIn };
  const specs = buildKit(theme);

  // A section to hold everything, placed at the viewport center.
  const section = figma.createSection();
  section.name = "UX Kit — " + theme.fontFamily;
  const startX = figma.viewport.center.x;
  const startY = figma.viewport.center.y;

  // lay components out in a grid
  const created: ComponentNode[] = [];
  let x = 0, y = 0, rowH = 0; const gap = 32, colW = 360;
  for (const spec of specs) {
    const comp = await buildComponent(spec, theme.fontFamily);
    comp.x = startX + x; comp.y = startY + y;
    created.push(comp);
    rowH = Math.max(rowH, spec.h);
    x += colW;
    if (x >= colW * 3) { x = 0; y += rowH + gap; rowH = 0; }
    figma.ui.postMessage({ type: "gen-progress", done: created.length, total: specs.length });
  }

  // wrap in the section
  const minX = Math.min(...created.map((c) => c.x)) - 40;
  const minY = Math.min(...created.map((c) => c.y)) - 40;
  const maxX = Math.max(...created.map((c) => c.x + c.width)) + 40;
  const maxY = Math.max(...created.map((c) => c.y + c.height)) + 40;
  section.x = minX; section.y = minY;
  section.resizeWithoutConstraints(maxX - minX, maxY - minY);
  for (const c of created) section.appendChild(c);

  // color styles
  for (const role of colorRoles(theme)) {
    const s = figma.createPaintStyle();
    s.name = role.name;
    s.paints = [paint(role.hex)];
  }
  // text styles
  for (const ts of typeScale(16)) {
    const font = await loadFont(theme.fontFamily, ts.weight);
    const s = figma.createTextStyle();
    s.name = "Type/" + ts.name;
    s.fontName = font;
    s.fontSize = ts.size;
  }

  figma.currentPage.selection = [section];
  figma.viewport.scrollAndZoomIntoView([section]);
  figma.ui.postMessage({ type: "gen-done", components: created.length, colors: colorRoles(theme).length, textStyles: typeScale(16).length });
  figma.notify(`Kit created — ${created.length} components + styles ✎`);
}
