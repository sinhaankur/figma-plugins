"use strict";
(() => {
  // src/library-core.ts
  var DEFAULT_RE = /^(component|frame|group|rectangle|ellipse)\s*\d*$/i;
  function parseName(name) {
    const clean = name.split(",")[0].replace(/\s*\w+=\S+.*/g, name.includes("=") ? "" : name);
    const parts = (name.includes("=") ? name.split("=")[0] : name).split("/").map((s) => s.trim()).filter(Boolean);
    return { path: parts, base: parts[parts.length - 1] || name };
  }
  function toTitleSlug(s) {
    return s.trim().replace(/[_\s]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  function normKey(name) {
    return parseName(name).base.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
  }
  function auditLibrary(components) {
    const issues = [];
    const add = (c, kind, severity, message, suggestion) => issues.push({ id: c.id, name: c.name, kind, severity, message, suggestion });
    const tops = components.filter((c) => !c.isVariant);
    const byKey = /* @__PURE__ */ new Map();
    for (const c of tops) {
      const k = normKey(c.name);
      byKey.set(k, [...byKey.get(k) || [], c]);
    }
    for (const c of tops) {
      const { path, base } = parseName(c.name);
      if (!c.name.trim()) {
        add(c, "unnamed", "error", "Component has no name.", "Give it a Category/Name.");
        continue;
      }
      if (DEFAULT_RE.test(base)) add(c, "default-name", "error", `Default name "${base}".`, `Rename, e.g. Buttons/${toTitleSlug(base)}`);
      if (path.length < 2) add(c, "not-grouped", "warn", `"${base}" isn't grouped.`, `Use a Category/Name, e.g. Buttons/${toTitleSlug(base)}`);
      if (base !== toTitleSlug(base) && !c.name.includes("=")) add(c, "inconsistent-case", "info", `"${base}" isn't Title Case.`, `Rename to "${toTitleSlug(base)}"`);
      if (c.usageCount === 0) add(c, "unused", "info", `"${base}" has 0 instances.`, "Consider archiving if unused.");
    }
    for (const [, group] of byKey) {
      if (group.length > 1) {
        for (const c of group) add(
          c,
          "duplicate-name",
          "warn",
          `Duplicate name shared by ${group.length} components.`,
          "Merge or disambiguate the names."
        );
      }
    }
    const bases = tops.map((c) => ({ c, k: normKey(c.name) }));
    for (let i = 0; i < bases.length; i++)
      for (let j = i + 1; j < bases.length; j++) {
        if (bases[i].k === bases[j].k) continue;
        const d = editDistance(bases[i].k, bases[j].k);
        if (d > 0 && d <= 2 && Math.max(bases[i].k.length, bases[j].k.length) >= 4) {
          add(
            bases[i].c,
            "near-duplicate",
            "info",
            `Very similar to "${parseName(bases[j].c.name).base}" \u2014 possible duplicate.`
          );
        }
      }
    return issues;
  }
  function proposeStructure(components) {
    const tree = {};
    for (const c of components.filter((x) => !x.isVariant)) {
      const { path, base } = parseName(c.name);
      const cat = path.length >= 2 ? path[0] : "Ungrouped";
      tree[cat] = tree[cat] || [];
      if (!tree[cat].includes(base)) tree[cat].push(base);
    }
    for (const k of Object.keys(tree)) tree[k].sort();
    return tree;
  }
  function healthScore(components, issues) {
    const tops = components.filter((c) => !c.isVariant).length || 1;
    const weight = { error: 3, warn: 1.5, info: 0.5 };
    const penalty = issues.reduce((s, i) => s + weight[i.severity], 0);
    return Math.max(0, Math.round(100 - penalty / tops * 20));
  }
  function summarizeLibrary(components, issues) {
    const tops = components.filter((c) => !c.isVariant).length;
    const variants = components.filter((c) => c.isVariant).length;
    const by = (s) => issues.filter((i) => i.severity === s).length;
    return {
      components: tops,
      variants,
      errors: by("error"),
      warnings: by("warn"),
      info: by("info"),
      score: healthScore(components, issues)
    };
  }

  // src/kit-core.ts
  var DEFAULT_THEME = {
    accent: "#F43F5E",
    fg: "#0E0F13",
    bg: "#FFFFFF",
    muted: "#9AA0AA",
    radius: 10,
    fontFamily: "Inter"
  };
  function buildKit(theme) {
    const t = { ...DEFAULT_THEME, ...theme };
    const R = t.radius;
    const specs = [
      // Buttons
      {
        name: "Buttons/Primary",
        w: 140,
        h: 44,
        fill: t.accent,
        radius: R,
        pad: 16,
        text: { value: "Button", color: "#FFFFFF", size: 15, weight: "Bold", align: "CENTER" }
      },
      {
        name: "Buttons/Secondary",
        w: 140,
        h: 44,
        fill: t.bg,
        stroke: t.muted,
        strokeW: 1,
        radius: R,
        pad: 16,
        text: { value: "Button", color: t.fg, size: 15, weight: "Medium", align: "CENTER" }
      },
      {
        name: "Buttons/Ghost",
        w: 140,
        h: 44,
        fill: "transparent",
        radius: R,
        pad: 16,
        text: { value: "Button", color: t.accent, size: 15, weight: "Medium", align: "CENTER" }
      },
      // Inputs
      {
        name: "Inputs/Text Field",
        w: 280,
        h: 48,
        fill: t.bg,
        stroke: t.muted,
        strokeW: 1,
        radius: R,
        pad: 14,
        text: { value: "Placeholder", color: t.muted, size: 15, weight: "Regular" }
      },
      // Badge / Chip
      {
        name: "Badge/Default",
        w: 72,
        h: 26,
        fill: hexA(t.accent, 0.15),
        radius: 999,
        pad: 10,
        text: { value: "New", color: t.accent, size: 12, weight: "SemiBold", align: "CENTER" }
      },
      {
        name: "Chip/Filter",
        w: 88,
        h: 32,
        fill: t.bg,
        stroke: t.muted,
        strokeW: 1,
        radius: 999,
        pad: 12,
        text: { value: "Filter", color: t.fg, size: 13, weight: "Medium", align: "CENTER" }
      },
      // Card
      {
        name: "Cards/Basic",
        w: 320,
        h: 180,
        fill: t.bg,
        stroke: hexA(t.muted, 0.3),
        strokeW: 1,
        radius: R + 4,
        pad: 20,
        text: { value: "Card title", color: t.fg, size: 17, weight: "Bold" }
      },
      // Avatar
      {
        name: "Avatar/Circle",
        w: 48,
        h: 48,
        fill: hexA(t.accent, 0.2),
        radius: 999,
        text: { value: "AS", color: t.accent, size: 16, weight: "Bold", align: "CENTER" }
      },
      // Toggle track
      { name: "Controls/Toggle", w: 48, h: 28, fill: t.accent, radius: 999 },
      // Tag
      {
        name: "Tag/Neutral",
        w: 64,
        h: 24,
        fill: hexA(t.muted, 0.15),
        radius: 6,
        pad: 8,
        text: { value: "Tag", color: t.fg, size: 12, weight: "Medium", align: "CENTER" }
      }
    ];
    return specs;
  }
  function typeScale(base = 16) {
    return [
      { name: "Display", size: Math.round(base * 3), weight: "Bold" },
      { name: "H1", size: Math.round(base * 2), weight: "Bold" },
      { name: "H2", size: Math.round(base * 1.5), weight: "SemiBold" },
      { name: "H3", size: Math.round(base * 1.25), weight: "SemiBold" },
      { name: "Body", size: base, weight: "Regular" },
      { name: "Small", size: Math.round(base * 0.875), weight: "Regular" },
      { name: "Caption", size: Math.round(base * 0.75), weight: "Medium" }
    ];
  }
  function colorRoles(theme) {
    const t = { ...DEFAULT_THEME, ...theme };
    return [
      { name: "Brand/Accent", hex: t.accent },
      { name: "Text/Primary", hex: t.fg },
      { name: "Text/Muted", hex: t.muted },
      { name: "Surface/Background", hex: t.bg },
      { name: "Border/Subtle", hex: t.muted }
    ];
  }
  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const aa = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
    return `#${h}${aa}`.toUpperCase();
  }

  // src/code.ts
  figma.showUI(__html__, { width: 460, height: 640, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    try {
      if (msg.type === "close") return figma.closePlugin();
      if (msg.type === "audit") return runAudit();
      if (msg.type === "select") return selectNode(msg.id);
      if (msg.type === "generate") return generateKit(msg.theme);
    } catch (e) {
      figma.notify("Error: " + (e && e.message ? e.message : String(e)));
      figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) });
    }
  };
  function collectComponents() {
    const out = [];
    const comps = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
    for (const node of comps) {
      if (node.type === "COMPONENT_SET") {
        out.push({
          id: node.id,
          name: node.name,
          isVariant: false,
          width: node.width,
          height: node.height
        });
      } else if (node.type === "COMPONENT") {
        const set = node.parent && node.parent.type === "COMPONENT_SET" ? node.parent : null;
        out.push({
          id: node.id,
          name: set ? set.name : node.name,
          isVariant: !!set,
          setName: set ? set.name : void 0,
          width: node.width,
          height: node.height
        });
      }
    }
    return out;
  }
  function runAudit() {
    const components = collectComponents();
    const issues = auditLibrary(components);
    const summary = summarizeLibrary(components, issues);
    const structure = proposeStructure(components);
    figma.ui.postMessage({ type: "audit-result", summary, issues, structure });
    if (components.length === 0) figma.notify("No components found in this file.");
  }
  async function selectNode(id) {
    const node = await figma.getNodeByIdAsync(id);
    if (node && "type" in node && node.type !== "PAGE" && node.type !== "DOCUMENT") {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  }
  function hexToRGB(hex) {
    let h = hex.replace("#", "");
    let a = 1;
    if (h.length === 8) {
      a = parseInt(h.slice(6, 8), 16) / 255;
      h = h.slice(0, 6);
    }
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a };
  }
  var paint = (hex) => {
    const c = hexToRGB(hex);
    return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
  };
  var fontsLoaded = /* @__PURE__ */ new Set();
  async function loadFont(family, style) {
    const key = family + "__" + style;
    const f = { family, style };
    if (fontsLoaded.has(key)) return f;
    try {
      await figma.loadFontAsync(f);
      fontsLoaded.add(key);
      return f;
    } catch {
      let fb = { family: "Inter", style };
      try {
        await figma.loadFontAsync(fb);
      } catch {
        fb = { family: "Inter", style: "Regular" };
        await figma.loadFontAsync(fb);
      }
      fontsLoaded.add("Inter__" + fb.style);
      return fb;
    }
  }
  async function buildComponent(spec, family) {
    var _a, _b;
    const comp = figma.createComponent();
    comp.name = spec.name;
    comp.resize(spec.w, spec.h);
    comp.cornerRadius = (_a = spec.radius) != null ? _a : 0;
    comp.fills = spec.fill && spec.fill !== "transparent" ? [paint(spec.fill)] : [];
    if (spec.stroke && spec.strokeW) {
      comp.strokes = [paint(spec.stroke)];
      comp.strokeWeight = spec.strokeW;
    }
    if (spec.text) {
      const font = await loadFont(family, spec.text.weight);
      const t = figma.createText();
      t.fontName = font;
      t.characters = spec.text.value;
      t.fontSize = spec.text.size;
      t.fills = [paint(spec.text.color)];
      t.textAlignVertical = "CENTER";
      t.textAlignHorizontal = spec.text.align === "CENTER" ? "CENTER" : "LEFT";
      const pad = (_b = spec.pad) != null ? _b : 12;
      t.resize(Math.max(1, spec.w - pad * 2), spec.h);
      t.x = pad;
      t.y = 0;
      t.textAutoResize = "NONE";
      comp.appendChild(t);
    }
    return comp;
  }
  async function generateKit(themeIn) {
    const theme = { ...DEFAULT_THEME, ...themeIn };
    const specs = buildKit(theme);
    const section = figma.createSection();
    section.name = "UX Kit \u2014 " + theme.fontFamily;
    const startX = figma.viewport.center.x;
    const startY = figma.viewport.center.y;
    const created = [];
    let x = 0, y = 0, rowH = 0;
    const gap = 32, colW = 360;
    for (const spec of specs) {
      const comp = await buildComponent(spec, theme.fontFamily);
      comp.x = startX + x;
      comp.y = startY + y;
      created.push(comp);
      rowH = Math.max(rowH, spec.h);
      x += colW;
      if (x >= colW * 3) {
        x = 0;
        y += rowH + gap;
        rowH = 0;
      }
      figma.ui.postMessage({ type: "gen-progress", done: created.length, total: specs.length });
    }
    const minX = Math.min(...created.map((c) => c.x)) - 40;
    const minY = Math.min(...created.map((c) => c.y)) - 40;
    const maxX = Math.max(...created.map((c) => c.x + c.width)) + 40;
    const maxY = Math.max(...created.map((c) => c.y + c.height)) + 40;
    section.x = minX;
    section.y = minY;
    section.resizeWithoutConstraints(maxX - minX, maxY - minY);
    for (const c of created) section.appendChild(c);
    for (const role of colorRoles(theme)) {
      const s = figma.createPaintStyle();
      s.name = role.name;
      s.paints = [paint(role.hex)];
    }
    for (const ts of typeScale(16)) {
      const font = await loadFont(theme.fontFamily, ts.weight);
      const s = figma.createTextStyle();
      s.name = "Type/" + ts.name;
      s.fontName = font;
      s.fontSize = ts.size;
    }
    figma.currentPage.selection = [section];
    figma.viewport.scrollAndZoomIntoView([section]);
    figma.ui.postMessage({ type: "gen-done", components: created.length, colors: colorRoles(theme).length, textStyles: typeScale(16).length });
    figma.notify(`Kit created \u2014 ${created.length} components + styles \u270E`);
  }
})();
