// audit-core.ts — the pure, testable heart of the style & accessibility auditor.
// No Figma API here: it takes plain node descriptors and returns findings, so it
// can be unit-tested headlessly. code.ts adapts real Figma nodes into these.
//
// © Ankur Sinha. Contrast math per WCAG 2.1.

export type RGB = { r: number; g: number; b: number }; // 0..1

// ── WCAG contrast ─────────────────────────────────────────────────────────────
function toLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function relativeLuminance({ r, g, b }: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
/** WCAG contrast ratio 1..21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
/** WCAG level for given text size. Large text = ≥24px, or ≥18.66px bold. */
export function contrastVerdict(ratio: number, fontSize: number, bold: boolean) {
  const large = fontSize >= 24 || (bold && fontSize >= 18.66);
  const aa = large ? 3 : 4.5;
  const aaa = large ? 4.5 : 7;
  return {
    ratio: Math.round(ratio * 100) / 100,
    passAA: ratio >= aa,
    passAAA: ratio >= aaa,
    large,
    needed: aa,
  };
}

// ── node descriptors (Figma-agnostic) ────────────────────────────────────────
export interface NodeDesc {
  id: string;
  name: string;
  type: string;                 // TEXT, FRAME, RECTANGLE, INSTANCE, COMPONENT…
  fills: RGB[];                 // solid fills only (resolved)
  boundColorStyle: boolean;     // fill is bound to a color style/variable
  // text-only
  fontSize?: number;
  bold?: boolean;
  bgColor?: RGB | null;         // resolved background behind the text
  characters?: string;
  // instance-only
  isDetachedInstance?: boolean; // was an instance, now detached
  // layout
  width?: number;
  height?: number;
  isInteractive?: boolean;      // button/link-ish (name hints or has onClick proto)
  // spacing
  paddings?: number[];          // auto-layout paddings
  itemSpacing?: number;
}

export type Severity = "error" | "warn" | "info";
export interface Finding {
  id: string;          // node id
  name: string;
  severity: Severity;
  rule: string;        // machine key
  message: string;     // human message
}

// ── the rules ─────────────────────────────────────────────────────────────────

const SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]; // 4/8 grid
const TAP_MIN = 44; // px, Apple/WCAG target

export interface AuditOptions {
  spacingScale?: number[];
  checkContrast?: boolean;
  checkHardcoded?: boolean;
  checkDetached?: boolean;
  checkSpacing?: boolean;
  checkTapTargets?: boolean;
}

export function auditNodes(nodes: NodeDesc[], opts: AuditOptions = {}): Finding[] {
  const o = {
    spacingScale: SPACING_SCALE, checkContrast: true, checkHardcoded: true,
    checkDetached: true, checkSpacing: true, checkTapTargets: true, ...opts,
  };
  const out: Finding[] = [];
  const push = (n: NodeDesc, severity: Severity, rule: string, message: string) =>
    out.push({ id: n.id, name: n.name, severity, rule, message });

  for (const n of nodes) {
    // 1. hardcoded colours (a fill that isn't bound to a style/variable)
    if (o.checkHardcoded && n.fills.length && !n.boundColorStyle && n.type !== "TEXT") {
      push(n, "warn", "hardcoded-color",
        `Hardcoded fill ${hex(n.fills[0])} — bind it to a color style/variable.`);
    }

    // 2. detached instances
    if (o.checkDetached && n.isDetachedInstance) {
      push(n, "warn", "detached-instance",
        `Detached instance — reconnect to its component or make it one.`);
    }

    // 3. text contrast
    if (o.checkContrast && n.type === "TEXT" && n.fills.length && n.bgColor) {
      const v = contrastVerdict(contrastRatio(n.fills[0], n.bgColor), n.fontSize ?? 16, !!n.bold);
      if (!v.passAA) {
        push(n, "error", "contrast",
          `Low contrast ${v.ratio}:1 (needs ${v.needed}:1) — "${(n.characters || "").slice(0, 24)}"`);
      } else if (!v.passAAA) {
        push(n, "info", "contrast-aaa",
          `Contrast ${v.ratio}:1 passes AA but not AAA.`);
      }
    }
    if (o.checkContrast && n.type === "TEXT" && n.fills.length && !n.bgColor) {
      push(n, "info", "contrast-unknown",
        `Couldn't resolve a background to check contrast — verify manually.`);
    }

    // 4. tap targets on interactive elements
    if (o.checkTapTargets && n.isInteractive && n.width != null && n.height != null) {
      const min = Math.min(n.width, n.height);
      if (min < TAP_MIN) {
        push(n, "error", "tap-target",
          `Tap target ${Math.round(n.width)}×${Math.round(n.height)} — below ${TAP_MIN}px minimum.`);
      }
    }

    // 5. off-system spacing (auto-layout)
    if (o.checkSpacing) {
      const vals = [...(n.paddings || []), ...(n.itemSpacing != null ? [n.itemSpacing] : [])];
      for (const v of vals) {
        if (v > 0 && !o.spacingScale.includes(v)) {
          push(n, "warn", "off-scale-spacing",
            `Spacing ${v}px is off the ${o.spacingScale.join("/")} scale.`);
          break; // one per node is enough
        }
      }
    }
  }
  return out;
}

// ── summary ───────────────────────────────────────────────────────────────────
export function summarize(findings: Finding[]) {
  const by = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const byRule: Record<string, number> = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  return { total: findings.length, errors: by("error"), warnings: by("warn"), info: by("info"), byRule };
}

export function hex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}
