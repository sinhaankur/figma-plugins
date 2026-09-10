"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, { width: 420, height: 560, themeColors: true });
  var FALLBACK = { family: "Inter", style: "Regular" };
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "cancel") {
      figma.closePlugin();
      return;
    }
    if (msg.type === "resize") {
      figma.ui.resize(420, Math.max(360, Math.min(760, msg.height)));
      return;
    }
    if (msg.type === "import") {
      await importPdf(msg);
    }
  };
  async function importPdf(msg) {
    const { pages, fileName, placeImage, placeText } = msg;
    const parent = figma.createFrame();
    parent.name = fileName.replace(/\.pdf$/i, "") || "PDF import";
    parent.layoutMode = "HORIZONTAL";
    parent.itemSpacing = 64;
    parent.fills = [];
    parent.clipsContent = false;
    parent.counterAxisSizingMode = "AUTO";
    parent.primaryAxisSizingMode = "AUTO";
    await figma.loadFontAsync(FALLBACK);
    const boldFont = { family: "Inter", style: "Bold" };
    const italicFont = { family: "Inter", style: "Italic" };
    try {
      await figma.loadFontAsync(boldFont);
    } catch {
    }
    try {
      await figma.loadFontAsync(italicFont);
    } catch {
    }
    let done = 0;
    for (const page of pages) {
      const frame = figma.createFrame();
      frame.name = `Page ${page.index + 1}`;
      frame.resize(page.widthPt, page.heightPt);
      frame.clipsContent = true;
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      if (placeImage && page.imagePng && page.imagePng.length) {
        const img = figma.createImage(page.imagePng);
        const rect = figma.createRectangle();
        rect.name = "Page render";
        rect.resize(page.widthPt, page.heightPt);
        rect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: img.hash }];
        rect.locked = true;
        frame.appendChild(rect);
      }
      if (placeText) {
        for (const run of page.texts) {
          if (!run.text.trim()) continue;
          const t = figma.createText();
          const font = run.bold ? boldFont : run.italic ? italicFont : FALLBACK;
          try {
            t.fontName = font;
          } catch {
            t.fontName = FALLBACK;
          }
          t.characters = run.text;
          t.fontSize = Math.max(1, run.fontSize);
          t.x = run.x;
          t.y = run.y;
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
    figma.notify(`Imported ${pages.length} page${pages.length === 1 ? "" : "s"} \u2014 text is editable \u270E`);
    figma.closePlugin();
  }
})();
