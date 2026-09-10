// tokens-core.ts — pure, testable conversion between Figma-agnostic style
// descriptors and design tokens (W3C Design Tokens JSON + CSS variables). No Figma
// API here so it can be unit-tested headlessly. code.ts adapts real Figma styles.
//
// © Ankur Sinha.

export type RGBA = { r: number; g: number; b: number; a?: number }; // 0..1

export interface ColorStyle { name: string; color: RGBA; }
export interface TypeStyle {
  name: string; fontFamily: string; fontStyle: string;
  fontSize: number; lineHeight?: number; letterSpacing?: number;
}
export interface SpaceToken { name: string; value: number; } // px

export interface StyleSet {
  colors: ColorStyle[];
  text: TypeStyle[];
  spacing: SpaceToken[];
}

// ── color helpers ─────────────────────────────────────────────────────────────
export function toHex({ r, g, b, a }: RGBA): string {
  const h = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  const base = `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
  return a != null && a < 1 ? base + h(a) : base;
}
export function fromHex(hex: string): RGBA {
  const s = hex.replace(/^#/, "");
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16) / 255;
  if (s.length === 3) {
    const d = (i: number) => parseInt(s[i] + s[i], 16) / 255;
    return { r: d(0), g: d(1), b: d(2) };
  }
  const rgba: RGBA = { r: n(0), g: n(2), b: n(4) };
  if (s.length === 8) rgba.a = n(6);
  return rgba;
}
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

// ── naming ────────────────────────────────────────────────────────────────────
// Figma style names use "/" for groups ("Brand/Accent"). Turn into token paths
// and kebab CSS var names.
export function nameToPath(name: string): string[] {
  return name.split("/").map((s) => s.trim()).filter(Boolean);
}
export function toKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
export function cssVarName(name: string, prefix = ""): string {
  const path = nameToPath(name).map(toKebab).filter(Boolean).join("-");
  return `--${prefix ? toKebab(prefix) + "-" : ""}${path}`;
}

// ── StyleSet → W3C Design Tokens JSON ─────────────────────────────────────────
// { color: { brand: { accent: { $value: "#F43F5E", $type: "color" } } }, ... }
type TokenNode = { $value: string | number; $type: string } | { [k: string]: TokenNode };

function setDeep(root: any, path: string[], leaf: TokenNode) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = toKebab(path[i]) || path[i];
    cur[key] = cur[key] || {};
    cur = cur[key];
  }
  cur[toKebab(path[path.length - 1]) || path[path.length - 1]] = leaf;
}

export function toTokensJSON(set: StyleSet): Record<string, unknown> {
  const out: any = { color: {}, typography: {}, spacing: {} };
  for (const c of set.colors) setDeep(out.color, nameToPath(c.name), { $value: toHex(c.color), $type: "color" });
  for (const t of set.text) {
    setDeep(out.typography, nameToPath(t.name), {
      $type: "typography",
      $value: {
        fontFamily: t.fontFamily, fontWeight: t.fontStyle,
        fontSize: `${t.fontSize}px`,
        ...(t.lineHeight ? { lineHeight: `${t.lineHeight}px` } : {}),
        ...(t.letterSpacing ? { letterSpacing: `${t.letterSpacing}px` } : {}),
      } as any,
    });
  }
  for (const s of set.spacing) setDeep(out.spacing, nameToPath(s.name), { $value: `${s.value}px`, $type: "dimension" });
  return out;
}

// ── StyleSet → CSS variables ──────────────────────────────────────────────────
export function toCSSVars(set: StyleSet, prefix = ""): string {
  const lines: string[] = [":root {"];
  for (const c of set.colors) lines.push(`  ${cssVarName(c.name, prefix)}: ${toHex(c.color)};`);
  for (const s of set.spacing) lines.push(`  ${cssVarName("space/" + s.name, prefix)}: ${s.value}px;`);
  for (const t of set.text) {
    const base = cssVarName("text/" + t.name, prefix);
    lines.push(`  ${base}-size: ${t.fontSize}px;`);
    lines.push(`  ${base}-family: ${t.fontFamily};`);
    if (t.lineHeight) lines.push(`  ${base}-line: ${t.lineHeight}px;`);
  }
  lines.push("}");
  return lines.join("\n");
}

// ── Tokens JSON → StyleSet (re-import: apply tokens back to Figma) ─────────────
export function fromTokensJSON(json: Record<string, any>): StyleSet {
  const set: StyleSet = { colors: [], text: [], spacing: [] };
  const walk = (obj: any, path: string[], kind: "color" | "spacing" | "typography") => {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && "$value" in v) {
        const name = [...path, k].join("/");
        if (kind === "color") set.colors.push({ name, color: fromHex(String((v as any).$value)) });
        else if (kind === "spacing") set.spacing.push({ name, value: parsePx(String((v as any).$value)) });
        else if (kind === "typography") {
          const val = (v as any).$value || {};
          set.text.push({
            name, fontFamily: val.fontFamily || "Inter", fontStyle: val.fontWeight || "Regular",
            fontSize: parsePx(val.fontSize || "16"),
            lineHeight: val.lineHeight ? parsePx(val.lineHeight) : undefined,
            letterSpacing: val.letterSpacing ? parsePx(val.letterSpacing) : undefined,
          });
        }
      } else if (v && typeof v === "object") {
        walk(v, [...path, k], kind);
      }
    }
  };
  if (json.color) walk(json.color, [], "color");
  if (json.spacing) walk(json.spacing, [], "spacing");
  if (json.typography) walk(json.typography, [], "typography");
  return set;
}
function parsePx(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(String(v).replace("px", "")) || 0;
}
