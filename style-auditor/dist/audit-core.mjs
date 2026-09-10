function toLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function contrastVerdict(ratio, fontSize, bold) {
  const large = fontSize >= 24 || bold && fontSize >= 18.66;
  const aa = large ? 3 : 4.5;
  const aaa = large ? 4.5 : 7;
  return {
    ratio: Math.round(ratio * 100) / 100,
    passAA: ratio >= aa,
    passAAA: ratio >= aaa,
    large,
    needed: aa
  };
}
const SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
const TAP_MIN = 44;
function auditNodes(nodes, opts = {}) {
  const o = {
    spacingScale: SPACING_SCALE,
    checkContrast: true,
    checkHardcoded: true,
    checkDetached: true,
    checkSpacing: true,
    checkTapTargets: true,
    ...opts
  };
  const out = [];
  const push = (n, severity, rule, message) => out.push({ id: n.id, name: n.name, severity, rule, message });
  for (const n of nodes) {
    if (o.checkHardcoded && n.fills.length && !n.boundColorStyle && n.type !== "TEXT") {
      push(
        n,
        "warn",
        "hardcoded-color",
        `Hardcoded fill ${hex(n.fills[0])} \u2014 bind it to a color style/variable.`
      );
    }
    if (o.checkDetached && n.isDetachedInstance) {
      push(
        n,
        "warn",
        "detached-instance",
        `Detached instance \u2014 reconnect to its component or make it one.`
      );
    }
    if (o.checkContrast && n.type === "TEXT" && n.fills.length && n.bgColor) {
      const v = contrastVerdict(contrastRatio(n.fills[0], n.bgColor), n.fontSize ?? 16, !!n.bold);
      if (!v.passAA) {
        push(
          n,
          "error",
          "contrast",
          `Low contrast ${v.ratio}:1 (needs ${v.needed}:1) \u2014 "${(n.characters || "").slice(0, 24)}"`
        );
      } else if (!v.passAAA) {
        push(
          n,
          "info",
          "contrast-aaa",
          `Contrast ${v.ratio}:1 passes AA but not AAA.`
        );
      }
    }
    if (o.checkContrast && n.type === "TEXT" && n.fills.length && !n.bgColor) {
      push(
        n,
        "info",
        "contrast-unknown",
        `Couldn't resolve a background to check contrast \u2014 verify manually.`
      );
    }
    if (o.checkTapTargets && n.isInteractive && n.width != null && n.height != null) {
      const min = Math.min(n.width, n.height);
      if (min < TAP_MIN) {
        push(
          n,
          "error",
          "tap-target",
          `Tap target ${Math.round(n.width)}\xD7${Math.round(n.height)} \u2014 below ${TAP_MIN}px minimum.`
        );
      }
    }
    if (o.checkSpacing) {
      const vals = [...n.paddings || [], ...n.itemSpacing != null ? [n.itemSpacing] : []];
      for (const v of vals) {
        if (v > 0 && !o.spacingScale.includes(v)) {
          push(
            n,
            "warn",
            "off-scale-spacing",
            `Spacing ${v}px is off the ${o.spacingScale.join("/")} scale.`
          );
          break;
        }
      }
    }
  }
  return out;
}
function summarize(findings) {
  const by = (s) => findings.filter((f) => f.severity === s).length;
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  return { total: findings.length, errors: by("error"), warnings: by("warn"), info: by("info"), byRule };
}
function hex({ r, g, b }) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}
export {
  auditNodes,
  contrastRatio,
  contrastVerdict,
  hex,
  relativeLuminance,
  summarize
};
