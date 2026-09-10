// code.ts — the Figma sandbox side of "PDF to Figma". Receives parsed pages from
// the UI (which runs pdf.js) and builds clean, editable Figma nodes: one frame per
// page, the rendered page as an image fill, real editable text nodes positioned to
// the PDF coordinates, and everything named + grouped. On-device; nothing leaves.
//
// © Ankur Sinha.

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

// ── message types (must mirror ui.ts) ────────────────────────────────────────
interface TextRun {
  text: string;
  x: number; y: number;         // top-left in page points, y-down
  w: number; h: number;
  fontSize: number;
  fontName: string;             // best-effort from the PDF
  color: [number, number, number];
  bold: boolean; italic: boolean;
}
interface PageData {
  index: number;
  widthPt: number; heightPt: number;   // page size in points
  imagePng: Uint8Array;                // rendered page (2x)
  texts: TextRun[];
}
type UIMsg =
  | { type: "import"; pages: PageData[]; fileName: string; placeImage: boolean; placeText: boolean }
  | { type: "cancel" }
  | { type: "resize"; height: number };

const FALLBACK = { family: "Inter", style: "Regular" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "cancel") { figma.closePlugin(); return; }
  if (msg.type === "resize") { figma.ui.resize(420, Math.max(360, Math.min(760, msg.height))); return; }
  if (msg.type === "import") { await importPdf(msg); }
};

async function importPdf(msg: Extract<UIMsg, { type: "import" }>) {
  const { pages, fileName, placeImage, placeText } = msg;
  const parent = figma.createFrame();
  parent.name = fileName.replace(/\.pdf$/i, "") || "PDF import";
  parent.layoutMode = "HORIZONTAL";
  parent.itemSpacing = 64;
  parent.fills = [];
  parent.clipsContent = false;
  parent.counterAxisSizingMode = "AUTO";
  parent.primaryAxisSizingMode = "AUTO";

  // preload the fonts we'll use so text nodes can be created/styled
  await figma.loadFontAsync(FALLBACK);
  const boldFont = { family: "Inter", style: "Bold" };
  const italicFont = { family: "Inter", style: "Italic" };
  try { await figma.loadFontAsync(boldFont); } catch {}
  try { await figma.loadFontAsync(italicFont); } catch {}

  let done = 0;
  for (const page of pages) {
    const frame = figma.createFrame();
    frame.name = `Page ${page.index + 1}`;
    frame.resize(page.widthPt, page.heightPt);
    frame.clipsContent = true;
    frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

    // page image as a background rectangle (exact look)
    if (placeImage && page.imagePng && page.imagePng.length) {
      const img = figma.createImage(page.imagePng);
      const rect = figma.createRectangle();
      rect.name = "Page render";
      rect.resize(page.widthPt, page.heightPt);
      rect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash }];
      rect.locked = true; // keep the reference layer out of the way of editing
      frame.appendChild(rect);
    }

    // editable text on top
    if (placeText) {
      for (const run of page.texts) {
        if (!run.text.trim()) continue;
        const t = figma.createText();
        const font = run.bold ? boldFont : run.italic ? italicFont : FALLBACK;
        try { t.fontName = font; } catch { t.fontName = FALLBACK; }
        t.characters = run.text;
        t.fontSize = Math.max(1, run.fontSize);
        t.x = run.x; t.y = run.y;
        t.fills = [{ type: "SOLID", color: { r: run.color[0], g: run.color[1], b: run.color[2] } }];
        t.name = run.text.slice(0, 40);
        frame.appendChild(t);
      }
    }

    parent.appendChild(frame);
    done++;
    figma.ui.postMessage({ type: "progress", done, total: pages.length });
  }

  figma.currentPage.appendChild(parent);
  figma.viewport.scrollAndZoomIntoView([parent]);
  figma.notify(`Imported ${pages.length} page${pages.length === 1 ? "" : "s"} — text is editable ✎`);
  figma.closePlugin();
}
