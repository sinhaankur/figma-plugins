// code.ts — Figma sandbox for HTML→Figma. Receives a FigmaNode tree from the UI
// (which walked the rendered DOM) and builds editable Figma layers: a page frame
// with positioned rects and text nodes. Fonts loaded on demand with a safe
// fallback to Inter.
//
// © Ankur Sinha.

import type { FigmaNode, RGBA } from "./css-core";

figma.showUI(__html__, { width: 460, height: 620, themeColors: true });

type UIMsg =
  | { type: "import"; tree: FigmaNode }   // legacy in-plugin render
  | { type: "receive"; tree: FigmaNode }  // from the "Send to Figma" bookmarklet
  | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "close") return figma.closePlugin();
  if (msg.type === "import" || msg.type === "receive") {
    try { await build(msg.tree); }
    catch (e: any) { figma.notify("Import failed: " + (e && e.message ? e.message : e)); }
  }
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
    if (n.opacity != null && n.opacity < 1) t.opacity = n.opacity;
    t.name = n.name || n.text.slice(0, 40);
    parent.appendChild(t);
  } else if (n.kind === "image" && (n.imageDataURL || n.imageBytes)) {
    const r = figma.createRectangle();
    r.x = ox + n.x; r.y = oy + n.y;
    r.resize(Math.max(1, n.w), Math.max(1, n.h));
    try {
      const bytes = n.imageBytes ? new Uint8Array(n.imageBytes) : dataURLToBytes(n.imageDataURL!);
      const img = figma.createImage(bytes);
      r.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash }];
    } catch { r.fills = [solid({ r: .85, g: .85, b: .87, a: 1 })]; }
    if (n.radius) r.cornerRadius = n.radius;
    if (n.opacity != null && n.opacity < 1) r.opacity = n.opacity;
    r.name = n.name || "image";
    parent.appendChild(r);
  } else {
    const r = figma.createRectangle();
    r.x = ox + n.x; r.y = oy + n.y;
    r.resize(Math.max(1, n.w), Math.max(1, n.h));
    r.fills = n.fill ? [solid(n.fill)] : [];
    if (n.stroke && n.strokeWidth) { r.strokes = [solid(n.stroke)]; r.strokeWeight = n.strokeWidth; }
    if (n.radius) r.cornerRadius = n.radius;
    if (n.opacity != null && n.opacity < 1) r.opacity = n.opacity;
    if (n.shadow) {
      r.effects = [{
        type: "DROP_SHADOW", visible: true, blendMode: "NORMAL",
        color: { r: n.shadow.color.r, g: n.shadow.color.g, b: n.shadow.color.b, a: n.shadow.color.a },
        offset: { x: n.shadow.x, y: n.shadow.y }, radius: n.shadow.blur, spread: n.shadow.spread,
      }];
    }
    r.name = n.name || "box";
    parent.appendChild(r);
  }
  if (n.children) for (const c of n.children) await addNode(c, parent, ox, oy);
}

// Decode a "data:image/png;base64,…" string to bytes (no atob in some sandboxes →
// use a small base64 decoder that always works in the Figma plugin VM).
function dataURLToBytes(dataURL: string): Uint8Array {
  const comma = dataURL.indexOf(",");
  const b64 = dataURL.slice(comma + 1);
  const bin = base64Decode(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Decode(s: string): string {
  if (typeof atob === "function") return atob(s);
  s = s.replace(/[^A-Za-z0-9+/]/g, "");
  let out = "";
  for (let i = 0; i < s.length; i += 4) {
    const e = [B64.indexOf(s[i]), B64.indexOf(s[i + 1]), B64.indexOf(s[i + 2]), B64.indexOf(s[i + 3])];
    const c1 = (e[0] << 2) | (e[1] >> 4);
    const c2 = ((e[1] & 15) << 4) | (e[2] >> 2);
    const c3 = ((e[2] & 3) << 6) | e[3];
    out += String.fromCharCode(c1);
    if (e[2] !== 64 && s[i + 2] !== undefined) out += String.fromCharCode(c2);
    if (e[3] !== 64 && s[i + 3] !== undefined) out += String.fromCharCode(c3);
  }
  return out;
}
