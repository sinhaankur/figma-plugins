"use strict";
(() => {
  // src/audit-core.ts
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
  var SPACING_SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
  var TAP_MIN = 44;
  function auditNodes(nodes, opts = {}) {
    var _a;
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
        const v = contrastVerdict(contrastRatio(n.fills[0], n.bgColor), (_a = n.fontSize) != null ? _a : 16, !!n.bold);
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

  // src/code.ts
  figma.showUI(__html__, { width: 400, height: 600, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "close") return figma.closePlugin();
    if (msg.type === "select") return selectNode(msg.id);
    if (msg.type === "run") return runAudit(msg.scope, msg.opts);
  };
  function selectNode(id) {
    const node = figma.getNodeById(id);
    if (node && "visible" in node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  }
  function toRGB(paint) {
    if (paint.type !== "SOLID" || paint.visible === false) return null;
    const c = paint.color;
    return { r: c.r, g: c.g, b: c.b };
  }
  function solidFills(node) {
    var _a;
    if (!("fills" in node) || node.fills === figma.mixed) return { rgbs: [], bound: false };
    const rgbs = [];
    for (const p of node.fills) {
      const c = toRGB(p);
      if (c) rgbs.push(c);
    }
    const bound = !!(node.fillStyleId && node.fillStyleId !== "") || !!("boundVariables" in node && ((_a = node.boundVariables) == null ? void 0 : _a.fills));
    return { rgbs, bound };
  }
  function bgBehind(node) {
    let p = node.parent;
    while (p && "fills" in p) {
      const f = p.fills;
      if (f !== figma.mixed && Array.isArray(f)) {
        for (const paint of f) {
          const c = toRGB(paint);
          if (c) return c;
        }
      }
      p = p.parent;
    }
    return null;
  }
  var INTERACTIVE = /\b(button|btn|cta|link|tab|chip|toggle|icon.?button)\b/i;
  function isInteractive(node) {
    if (INTERACTIVE.test(node.name)) return true;
    const reactions = node.reactions;
    return !!(reactions && reactions.length);
  }
  function describe(node) {
    const { rgbs, bound } = solidFills(node);
    const d = {
      id: node.id,
      name: node.name,
      type: node.type,
      fills: rgbs,
      boundColorStyle: bound,
      width: "width" in node ? node.width : void 0,
      height: "height" in node ? node.height : void 0,
      isInteractive: isInteractive(node)
    };
    if (node.type === "TEXT") {
      const t = node;
      d.fontSize = typeof t.fontSize === "number" ? t.fontSize : 16;
      const fw = t.fontName !== figma.mixed && t.fontName.style || "";
      d.bold = /bold|black|semibold|heavy/i.test(fw);
      d.characters = t.characters;
      d.bgColor = bgBehind(node);
    }
    if (node.type === "INSTANCE") {
      d.isDetachedInstance = false;
    }
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      const f = node;
      d.paddings = [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft];
      d.itemSpacing = f.itemSpacing;
    }
    return d;
  }
  function markDetached(node, d) {
    if (node.type === "FRAME" && /\//.test(node.name)) d.isDetachedInstance = true;
  }
  function runAudit(scope, opts) {
    const roots = scope === "selection" && figma.currentPage.selection.length ? figma.currentPage.selection : figma.currentPage.children;
    const descs = [];
    const visit = (node) => {
      const d = describe(node);
      markDetached(node, d);
      descs.push(d);
      if ("children" in node) for (const c of node.children) visit(c);
    };
    for (const r of roots) visit(r);
    const findings = auditNodes(descs, opts);
    const summary = summarize(findings);
    figma.ui.postMessage({ type: "result", findings, summary, scanned: descs.length });
  }
})();
