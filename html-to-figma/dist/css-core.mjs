function parseColor(css) {
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
    const to = (i, len) => parseInt(len === 1 ? h[i] + h[i] : h.slice(i, i + 2), 16) / 255;
    if (h.length === 3) return { r: to(0, 1), g: to(1, 1), b: to(2, 1), a: 1 };
    if (h.length === 6) return { r: to(0, 2), g: to(2, 2), b: to(4, 2), a: 1 };
    if (h.length === 8) {
      const a = to(6, 2);
      return a === 0 ? null : { r: to(0, 2), g: to(2, 2), b: to(4, 2), a };
    }
  }
  return null;
}
function num(s) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function px(v) {
  return num(String(v).replace("px", ""));
}
function parseRadius(css) {
  const first = px((css || "0").split(/\s+/)[0]);
  return Math.max(0, first);
}
function fontStyleName(weight, italic) {
  const w = parseInt(weight, 10) || 400;
  const base = w >= 800 ? "Black" : w >= 700 ? "Bold" : w >= 600 ? "SemiBold" : w >= 500 ? "Medium" : w <= 300 ? "Light" : "Regular";
  if (italic) return base === "Regular" ? "Italic" : `${base} Italic`;
  return base;
}
function textAlign(css) {
  switch ((css || "").toLowerCase()) {
    case "center":
      return "CENTER";
    case "right":
    case "end":
      return "RIGHT";
    case "justify":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
}
function parseBoxShadow(css) {
  if (!css || css === "none") return null;
  const color = parseColor(css) || { r: 0, g: 0, b: 0, a: 0.25 };
  const nums = css.match(/-?[\d.]+px/g);
  if (!nums || nums.length < 2) return null;
  const v = nums.map((n) => parseFloat(n));
  return { x: v[0], y: v[1], blur: v[2] || 0, spread: v[3] || 0, color };
}
function isRenderable(style) {
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (parseFloat(style.opacity) === 0) return false;
  if (style.width <= 0 || style.height <= 0) return false;
  return true;
}
function hasVisibleBox(bg, border, radius) {
  return !!bg || !!border || radius > 0;
}
export {
  fontStyleName,
  hasVisibleBox,
  isRenderable,
  parseBoxShadow,
  parseColor,
  parseRadius,
  px,
  textAlign
};
