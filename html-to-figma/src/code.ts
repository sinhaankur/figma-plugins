// code.ts — Figma sandbox for HTML→Figma. Receives a FigmaNode tree from the UI
// (which walked the rendered DOM) and builds editable Figma layers: a page frame
// with positioned rects and text nodes. Fonts loaded on demand with a safe
// fallback to Inter.
//
// © Ankur Sinha.

import type { FigmaNode, RGBA } from "./css-core";

figma.showUI(__html__, { width: 460, height: 620, themeColors: true });

type UIMsg = { type: "import"; tree: FigmaNode } | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "close") return figma.closePlugin();
  if (msg.type === "import") return build(msg.tree);
};

const loaded = new Set<string>();
async function ensureFont(family: string, style: string): Promise<FontName> {
  const key = `${family}__${style}`;
  const font: FontName = { family, style };
  if (loaded.has(key)) return font;
  try { await figma.loadFontAsync(font); loaded.add(key); return font; }
  catch {
    const fb: FontName = { family: "Inter", style: styleFallback(style) };
    const fbKey = `Inter__${fb.style}`;
    if (!loaded.has(fbKey)) { try { await figma.loadFontAsync(fb); } catch { fb.style = "Regular"; await figma.loadFontAsync(fb); } loaded.add(fbKey); }
    return fb;
  }
}
function styleFallback(style: string): string {
  if (/black/i.test(style)) return "Black";
  if (/bold/i.test(style) && /italic/i.test(style)) return "Bold Italic";
  if (/bold/i.test(style)) return "Bold";
  if (/semibold/i.test(style)) return "Semi Bold";
  if (/medium/i.test(style)) return "Medium";
  if (/light/i.test(style)) return "Light";
  if (/italic/i.test(style)) return "Italic";
  return "Regular";
}

const solid = (c: RGBA): SolidPaint => ({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a });

async function build(tree: FigmaNode) {
  // count for progress
  let total = 0; const count = (n: FigmaNode) => { total++; n.children?.forEach(count); }; count(tree);
  let done = 0;

  const page = figma.createFrame();
  page.name = tree.name || "Imported page";
  page.resize(Math.max(1, tree.w), Math.max(1, tree.h));
  page.x = figma.viewport.center.x - tree.w / 2;
  page.y = figma.viewport.center.y - tree.h / 2;
  page.fills = tree.fill ? [solid(tree.fill)] : [];
  page.clipsContent = true;

  const originX = page.x, originY = page.y;

  for (const child of tree.children || []) {
    await addNode(child, page, originX, originY);
    done++; if (done % 25 === 0) figma.ui.postMessage({ type: "progress", done, total });
  }

  figma.currentPage.selection = [page];
  figma.viewport.scrollAndZoomIntoView([page]);
  figma.ui.postMessage({ type: "done", count: total });
  figma.notify(`HTML imported — ${total} editable layers ✎`);
}

async function addNode(n: FigmaNode, parent: FrameNode, ox: number, oy: number) {
  if (n.kind === "text" && n.text) {
    const font = await ensureFont(n.fontFamily || "Inter", n.fontStyle || "Regular");
    const t = figma.createText();
    t.fontName = font;
    t.characters = n.text;
    t.fontSize = Math.max(1, n.fontSize || 16);
    t.x = ox + n.x; t.y = oy + n.y;
    try { t.resize(Math.max(1, n.w), t.height); t.textAutoResize = "HEIGHT"; } catch {}
    if (n.color) t.fills = [solid(n.color)];
    if (n.align) t.textAlignHorizontal = n.align;
    if (n.lineHeight) t.lineHeight = { value: n.lineHeight, unit: "PIXELS" };
    if (n.letterSpacing) t.letterSpacing = { value: n.letterSpacing, unit: "PIXELS" };
    t.name = n.name || n.text.slice(0, 40);
    parent.appendChild(t);
  } else {
    const r = figma.createRectangle();
    r.x = ox + n.x; r.y = oy + n.y;
    r.resize(Math.max(1, n.w), Math.max(1, n.h));
    r.fills = n.fill ? [solid(n.fill)] : [];
    if (n.stroke && n.strokeWidth) { r.strokes = [solid(n.stroke)]; r.strokeWeight = n.strokeWidth; }
    if (n.radius) r.cornerRadius = n.radius;
    if (n.opacity != null && n.opacity < 1) r.opacity = n.opacity;
    r.name = n.name || "box";
    parent.appendChild(r);
  }
  if (n.children) for (const c of n.children) await addNode(c, parent, ox, oy);
}
