// css-core.ts — pure, testable converters from CSS computed values to Figma
// values. No DOM, no Figma API — so it's unit-tested headlessly. ui.ts reads
// getComputedStyle and hands strings here; code.ts builds Figma nodes from the
// resulting FigmaNode tree.
//
// © Ankur Sinha.

export type RGBA = { r: number; g: number; b: number; a: number }; // 0..1

// ── color ─────────────────────────────────────────────────────────────────────
/** Parse a CSS color string (rgb/rgba/hex) → RGBA 0..1. Returns null for none/transparent. */
export function parseColor(css: string): RGBA | null {
  if (!css) return null;
  const s = css.trim().toLowerCase();
  if (s === "transparent" || s === "none") return null;
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\/\s]+/).filter(Boolean);
    const r = num(parts[0]) / 255, g = num(parts[1]) / 255, b = num(parts[2]) / 255;
    const a = parts[3] != null ? clamp01(num(parts[3])) : 1;
    if (a === 0) return null;
    return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a };
  }
  m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1];
    const to = (i: number, len: number) => parseInt(len === 1 ? h[i] + h[i] : h.slice(i, i + 2), 16) / 255;
    if (h.length === 3) return { r: to(0, 1), g: to(1, 1), b: to(2, 1), a: 1 };
    if (h.length === 6) return { r: to(0, 2), g: to(2, 2), b: to(4, 2), a: 1 };
    if (h.length === 8) { const a = to(6, 2); return a === 0 ? null : { r: to(0, 2), g: to(2, 2), b: to(4, 2), a }; }
  }
  return null;
}
function num(s: string) { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; }
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

// ── lengths ───────────────────────────────────────────────────────────────────
export function px(v: string): number { return num(String(v).replace("px", "")); }

// ── border radius (Figma corner radius) ───────────────────────────────────────
export function parseRadius(css: string): number {
  // computed radius can be "8px" or "8px 8px" etc — take the first, cap huge (pills)
  const first = px((css || "0").split(/\s+/)[0]);
  return Math.max(0, first);
}

// ── font weight → Figma style name ────────────────────────────────────────────
export function fontStyleName(weight: string, italic: boolean): string {
  const w = parseInt(weight, 10) || 400;
  const base =
    w >= 800 ? "Black" : w >= 700 ? "Bold" : w >= 600 ? "SemiBold" :
    w >= 500 ? "Medium" : w <= 300 ? "Light" : "Regular";
  if (italic) return base === "Regular" ? "Italic" : `${base} Italic`;
  return base;
}

// ── text align ─────────────────────────────────────────────────────────────────
export function textAlign(css: string): "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" {
  switch ((css || "").toLowerCase()) {
    case "center": return "CENTER";
    case "right": case "end": return "RIGHT";
    case "justify": return "JUSTIFIED";
    default: return "LEFT";
  }
}

// ── the intermediate node the UI produces and code.ts consumes ────────────────
export interface FigmaNode {
  kind: "frame" | "text" | "rect" | "image";
  name: string;
  x: number; y: number; w: number; h: number;   // absolute, page coords
  fill?: RGBA | null;
  stroke?: RGBA | null;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  color?: RGBA | null;
  align?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  lineHeight?: number;
  letterSpacing?: number;
  // image
  imageBytes?: number[];        // PNG bytes (as array — postMessage-safe)
  // effect
  shadow?: Shadow | null;
  children?: FigmaNode[];
}

export interface Shadow { x: number; y: number; blur: number; spread: number; color: RGBA; }

/** Parse a CSS box-shadow (first shadow only) → Figma drop-shadow values. */
export function parseBoxShadow(css: string): Shadow | null {
  if (!css || css === "none") return null;
  const color = parseColor(css) || { r: 0, g: 0, b: 0, a: 0.25 };
  const nums = css.match(/-?[\d.]+px/g);
  if (!nums || nums.length < 2) return null;
  const v = nums.map((n) => parseFloat(n));
  return { x: v[0], y: v[1], blur: v[2] || 0, spread: v[3] || 0, color };
}

/** Should this element become a visible Figma layer at all? (skip empty/hidden) */
export function isRenderable(style: {
  display: string; visibility: string; opacity: string; width: number; height: number;
}): boolean {
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (parseFloat(style.opacity) === 0) return false;
  if (style.width <= 0 || style.height <= 0) return false;
  return true;
}

/** Whether an element has any paint worth making a rect/frame fill for. */
export function hasVisibleBox(bg: RGBA | null, border: RGBA | null, radius: number): boolean {
  return !!bg || !!border || radius > 0;
}
