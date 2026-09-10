// code.ts — Figma sandbox for the Style & A11y Auditor. Walks the current page (or
// selection), adapts real nodes into Figma-agnostic NodeDescs, runs the tested
// audit-core, and reports findings. Clicking a finding selects + zooms its node.
//
// © Ankur Sinha.

import { auditNodes, summarize, type NodeDesc, type RGB, type Finding, type AuditOptions } from "./audit-core";

figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

type UIMsg =
  | { type: "run"; scope: "page" | "selection"; opts: AuditOptions }
  | { type: "select"; id: string }
  | { type: "close" };

figma.ui.onmessage = async (msg: UIMsg) => {
  if (msg.type === "close") return figma.closePlugin();
  if (msg.type === "select") return selectNode(msg.id);
  if (msg.type === "run") return runAudit(msg.scope, msg.opts);
};

function selectNode(id: string) {
  const node = figma.getNodeById(id) as SceneNode | null;
  if (node && "visible" in node) {
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
  }
}

function toRGB(paint: Paint): RGB | null {
  if (paint.type !== "SOLID" || paint.visible === false) return null;
  const c = paint.color;
  return { r: c.r, g: c.g, b: c.b };
}
function solidFills(node: SceneNode): { rgbs: RGB[]; bound: boolean } {
  if (!("fills" in node) || node.fills === figma.mixed) return { rgbs: [], bound: false };
  const rgbs: RGB[] = [];
  for (const p of node.fills as Paint[]) { const c = toRGB(p); if (c) rgbs.push(c); }
  const bound = !!(node.fillStyleId && node.fillStyleId !== "") ||
    !!(("boundVariables" in node) && (node as any).boundVariables?.fills);
  return { rgbs, bound };
}

// Resolve the background behind a text node: walk up to the first ancestor with a
// solid fill (good-enough heuristic; exact stacking needs a render pass).
function bgBehind(node: SceneNode): RGB | null {
  let p: BaseNode | null = node.parent;
  while (p && "fills" in p) {
    const f = (p as GeometryMixin).fills;
    if (f !== figma.mixed && Array.isArray(f)) {
      for (const paint of f) { const c = toRGB(paint); if (c) return c; }
    }
    p = p.parent;
  }
  return null;
}

const INTERACTIVE = /\b(button|btn|cta|link|tab|chip|toggle|icon.?button)\b/i;
function isInteractive(node: SceneNode): boolean {
  if (INTERACTIVE.test(node.name)) return true;
  const reactions = (node as any).reactions as any[] | undefined;
  return !!(reactions && reactions.length);
}

function describe(node: SceneNode): NodeDesc {
  const { rgbs, bound } = solidFills(node);
  const d: NodeDesc = {
    id: node.id, name: node.name, type: node.type,
    fills: rgbs, boundColorStyle: bound,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined,
    isInteractive: isInteractive(node),
  };
  if (node.type === "TEXT") {
    const t = node as TextNode;
    d.fontSize = typeof t.fontSize === "number" ? t.fontSize : 16;
    const fw = (t.fontName !== figma.mixed && (t.fontName as FontName).style) || "";
    d.bold = /bold|black|semibold|heavy/i.test(fw);
    d.characters = t.characters;
    d.bgColor = bgBehind(node);
  }
  if (node.type === "INSTANCE") {
    // a former instance that's been detached shows as FRAME; true instances are fine.
    d.isDetachedInstance = false;
  }
  if ("layoutMode" in node && (node as FrameNode).layoutMode !== "NONE") {
    const f = node as FrameNode;
    d.paddings = [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft];
    d.itemSpacing = f.itemSpacing;
  }
  return d;
}

// Heuristic for detached instances: a frame named like a component that has no
// component link. (Figma has no direct "was detached" flag.)
function markDetached(node: SceneNode, d: NodeDesc) {
  if (node.type === "FRAME" && /\//.test(node.name)) d.isDetachedInstance = true;
}

function runAudit(scope: "page" | "selection", opts: AuditOptions) {
  const roots: readonly SceneNode[] =
    scope === "selection" && figma.currentPage.selection.length
      ? figma.currentPage.selection
      : figma.currentPage.children;

  const descs: NodeDesc[] = [];
  const visit = (node: SceneNode) => {
    const d = describe(node);
    markDetached(node, d);
    descs.push(d);
    if ("children" in node) for (const c of node.children) visit(c as SceneNode);
  };
  for (const r of roots) visit(r);

  const findings: Finding[] = auditNodes(descs, opts);
  const summary = summarize(findings);
  figma.ui.postMessage({ type: "result", findings, summary, scanned: descs.length });
}
