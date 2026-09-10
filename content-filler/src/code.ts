// code.ts — Figma sandbox for Content Filler. Fills selected text layers with
// realistic on-device data: auto-detect each layer's type from its name (or force
// one type for all). Each layer gets a different seed so a list looks varied.
//
// © Ankur Sinha.

import { generate, detectSmart, type FieldType } from "./data-core";

figma.showUI(__html__, { width: 380, height: 520, themeColors: true });

type UIMsg =
  | { type: "fill"; mode: "auto" | FieldType; seed: number }
  | { type: "count" }
  | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "close") return figma.closePlugin();
  if (msg.type === "count") return sendCount();
  if (msg.type === "fill") return fill(msg.mode, msg.seed);
};

function textNodesInSelection(): TextNode[] {
  const out: TextNode[] = [];
  const visit = (n: SceneNode) => {
    if (n.type === "TEXT") out.push(n);
    if ("children" in n) for (const c of n.children) visit(c as SceneNode);
  };
  for (const n of figma.currentPage.selection) visit(n);
  return out;
}

function sendCount() {
  figma.ui.postMessage({ type: "count", n: textNodesInSelection().length });
}

async function fill(mode: "auto" | FieldType, baseSeed: number) {
  const nodes = textNodesInSelection();
  if (!nodes.length) { figma.notify("Select some text layers first."); return; }

  let filled = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // must load the node's font before setting characters
    try {
      const f = node.fontName;
      if (f !== figma.mixed) await figma.loadFontAsync(f as FontName);
      else { // mixed fonts — load the first run's font
        await figma.loadFontAsync(node.getRangeFontName(0, 1) as FontName);
      }
    } catch { continue; }

    const type: FieldType = mode === "auto" ? detectSmart(node.name, node.characters.length) : mode;
    node.characters = generate(type, baseSeed + i * 101 + node.name.length);
    filled++;
  }
  figma.notify(`Filled ${filled} text layer${filled === 1 ? "" : "s"}`);
  figma.ui.postMessage({ type: "filled", n: filled });
}

figma.on("selectionchange", sendCount);
sendCount();
