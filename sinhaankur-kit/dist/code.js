"use strict";
(() => {
  // src/cores/kit-core.ts
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
  function hexA(hex2, a) {
    const h = hex2.replace("#", "");
    const aa = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
    return `#${h}${aa}`.toUpperCase();
  }

  // src/cores/audit-core.ts
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

  // src/cores/library-core.ts
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

  // src/cores/tokens-core.ts
  function toHex({ r, g, b, a }) {
    const h = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
    const base = `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
    return a != null && a < 1 ? base + h(a) : base;
  }
  function fromHex(hex2) {
    const s = hex2.replace(/^#/, "");
    const n = (i) => parseInt(s.slice(i, i + 2), 16) / 255;
    if (s.length === 3) {
      const d = (i) => parseInt(s[i] + s[i], 16) / 255;
      return { r: d(0), g: d(1), b: d(2) };
    }
    const rgba = { r: n(0), g: n(2), b: n(4) };
    if (s.length === 8) rgba.a = n(6);
    return rgba;
  }
  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }
  function nameToPath(name) {
    return name.split("/").map((s) => s.trim()).filter(Boolean);
  }
  function toKebab(s) {
    return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_/]+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  function cssVarName(name, prefix = "") {
    const path = nameToPath(name).map(toKebab).filter(Boolean).join("-");
    return `--${prefix ? toKebab(prefix) + "-" : ""}${path}`;
  }
  function setDeep(root, path, leaf) {
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
      const key = toKebab(path[i]) || path[i];
      cur[key] = cur[key] || {};
      cur = cur[key];
    }
    cur[toKebab(path[path.length - 1]) || path[path.length - 1]] = leaf;
  }
  function toTokensJSON(set) {
    const out = { color: {}, typography: {}, spacing: {} };
    for (const c of set.colors) setDeep(out.color, nameToPath(c.name), { $value: toHex(c.color), $type: "color" });
    for (const t of set.text) {
      setDeep(out.typography, nameToPath(t.name), {
        $type: "typography",
        $value: {
          fontFamily: t.fontFamily,
          fontWeight: t.fontStyle,
          fontSize: `${t.fontSize}px`,
          ...t.lineHeight ? { lineHeight: `${t.lineHeight}px` } : {},
          ...t.letterSpacing ? { letterSpacing: `${t.letterSpacing}px` } : {}
        }
      });
    }
    for (const s of set.spacing) setDeep(out.spacing, nameToPath(s.name), { $value: `${s.value}px`, $type: "dimension" });
    return out;
  }
  function toCSSVars(set, prefix = "") {
    const lines = [":root {"];
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
  function fromTokensJSON(json) {
    const set = { colors: [], text: [], spacing: [] };
    const walk = (obj, path, kind) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && "$value" in v) {
          const name = [...path, k].join("/");
          if (kind === "color") set.colors.push({ name, color: fromHex(String(v.$value)) });
          else if (kind === "spacing") set.spacing.push({ name, value: parsePx(String(v.$value)) });
          else if (kind === "typography") {
            const val = v.$value || {};
            set.text.push({
              name,
              fontFamily: val.fontFamily || "Inter",
              fontStyle: val.fontWeight || "Regular",
              fontSize: parsePx(val.fontSize || "16"),
              lineHeight: val.lineHeight ? parsePx(val.lineHeight) : void 0,
              letterSpacing: val.letterSpacing ? parsePx(val.letterSpacing) : void 0
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
  function parsePx(v) {
    return typeof v === "number" ? v : parseFloat(String(v).replace("px", "")) || 0;
  }

  // src/cores/data-core.ts
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  var int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  var FIRST = ["Ankur", "Maya", "Liam", "Sofia", "Kenji", "Amara", "Noah", "Priya", "Diego", "Yuki", "Omar", "Ines", "Leo", "Nadia", "Arjun", "Elena", "Tariq", "Mila", "Ravi", "Chloe", "Hassan", "Aiko", "Marco", "Zara", "Ivan"];
  var LAST = ["Sinha", "Okafor", "Nguyen", "Rossi", "Tanaka", "Khan", "Silva", "Kim", "M\xFCller", "Haddad", "Patel", "Novak", "Costa", "Sato", "Reyes", "Andersson", "Yilmaz", "Dubois", "Bianchi", "Sharma"];
  var CITY = ["Toronto", "Mumbai", "Lisbon", "Kyoto", "Nairobi", "Oslo", "Medell\xEDn", "Da Nang", "Porto", "Austin", "Tbilisi", "Cape Town", "Lyon", "Busan", "Valencia", "Tallinn", "Chiang Mai", "Bogot\xE1"];
  var COUNTRY = ["Canada", "India", "Portugal", "Japan", "Kenya", "Norway", "Colombia", "Vietnam", "Estonia", "Georgia", "Spain", "South Korea", "France", "South Africa"];
  var COMPANY = ["Northwind", "Lumen", "Kelo", "Cadence", "Vireo", "Halcyon", "Tessellate", "Orbit", "Meridian", "Fathom", "Aperture", "Solstice", "Verdant", "Cobalt", "Ridge"];
  var SUFFIX = ["Labs", "Studio", "Systems", "Works", "Collective", "& Co", "Group", ""];
  var TITLE = ["Product Designer", "Founder", "Engineer", "PT Coach", "Analyst", "Head of Ops", "Researcher", "Creative Director", "Physiotherapist", "Trainer"];
  var WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud".split(" ");
  function generate(type, seed) {
    const r = rng(seed);
    switch (type) {
      case "firstName":
        return pick(r, FIRST);
      case "lastName":
        return pick(r, LAST);
      case "fullName":
        return `${pick(r, FIRST)} ${pick(r, LAST)}`;
      case "username":
        return `${pick(r, FIRST).toLowerCase()}${int(r, 1, 99)}`;
      case "email":
        return `${pick(r, FIRST).toLowerCase()}.${pick(r, LAST).toLowerCase()}@${pick(r, COMPANY).toLowerCase()}.com`;
      case "phone":
        return `+1 ${int(r, 200, 989)} ${int(r, 200, 999)} ${String(int(r, 0, 9999)).padStart(4, "0")}`;
      case "company": {
        const s = pick(r, SUFFIX);
        return `${pick(r, COMPANY)}${s ? " " + s : ""}`;
      }
      case "jobTitle":
        return pick(r, TITLE);
      case "city":
        return pick(r, CITY);
      case "country":
        return pick(r, COUNTRY);
      case "price":
        return `$${int(r, 3, 480)}.${String(int(r, 0, 99)).padStart(2, "0")}`;
      case "percent":
        return `${int(r, 1, 100)}%`;
      case "number":
        return String(int(r, 1, 9999));
      case "rating":
        return (Math.round((3.4 + r() * 1.6) * 10) / 10).toFixed(1);
      // 3.4–5.0
      case "date": {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${pick(r, months)} ${int(r, 1, 28)}, ${int(r, 2023, 2026)}`;
      }
      case "time":
        return `${int(r, 1, 12)}:${String(int(r, 0, 59)).padStart(2, "0")} ${r() > 0.5 ? "AM" : "PM"}`;
      case "url":
        return `${pick(r, COMPANY).toLowerCase()}.com`;
      case "word":
        return cap(pick(r, WORDS));
      case "sentence":
        return sentence(r, int(r, 6, 12));
      case "paragraph":
        return Array.from({ length: int(r, 2, 4) }, () => sentence(r, int(r, 6, 14))).join(" ");
    }
  }
  function sentence(r, n) {
    const w = Array.from({ length: n }, () => pick(r, WORDS));
    return cap(w.join(" ")) + ".";
  }
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var RULES = [
    [/full.?name|^name$|display.?name/i, "fullName"],
    [/first.?name|given/i, "firstName"],
    [/last.?name|surname|family/i, "lastName"],
    [/user.?name|handle/i, "username"],
    [/e.?mail/i, "email"],
    [/phone|mobile|tel\b/i, "phone"],
    [/company|org|brand|business/i, "company"],
    [/title|role|position|job/i, "jobTitle"],
    [/city|town/i, "city"],
    [/country|nation/i, "country"],
    [/price|cost|amount|\$|total|fee/i, "price"],
    [/percent|%|discount/i, "percent"],
    [/rating|stars?|score/i, "rating"],
    [/date|day|deadline|due/i, "date"],
    [/time\b/i, "time"],
    [/url|link|website|domain/i, "url"],
    [/count|qty|quantity|number|#/i, "number"],
    [/paragraph|body|desc|about|bio|content/i, "paragraph"],
    [/sentence|caption|subtitle|summary/i, "sentence"],
    [/word|label|tag|category/i, "word"]
  ];
  function detectSmart(layerName, existingLen) {
    for (const [re, type] of RULES) if (re.test(layerName)) return type;
    if (existingLen <= 2) return "number";
    if (existingLen <= 16) return "word";
    if (existingLen <= 60) return "sentence";
    return "paragraph";
  }

  // src/code.ts
  figma.showUI(__html__, { width: 480, height: 660, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    try {
      switch (msg.type) {
        case "create-kit":
          return createKit(msg.theme);
        case "audit":
          return runAudit(msg.scope, msg.opts);
        case "audit-library":
          return runLibraryAudit();
        case "tokens-export":
          return tokensExport(msg.prefix);
        case "tokens-import":
          return tokensImport(msg.json);
        case "fill":
          return fillContent(msg.mode, msg.seed);
        case "html-import":
          return htmlImport(msg.tree);
        case "select":
          return selectNode(msg.id);
        case "dev-export":
          return devExport(msg.prefix);
        case "close":
          return figma.closePlugin();
      }
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: String((e == null ? void 0 : e.message) || e) });
    }
  };
  var hexToRGB = (hex2) => {
    const h = hex2.replace("#", "");
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  };
  var solid = (c) => ({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a });
  var loaded = /* @__PURE__ */ new Set();
  async function font(family, style) {
    const f = { family, style };
    const k = family + style;
    if (loaded.has(k)) return f;
    try {
      await figma.loadFontAsync(f);
      loaded.add(k);
      return f;
    } catch {
      const fb = { family: "Inter", style: /bold/i.test(style) ? "Bold" : /medium/i.test(style) ? "Medium" : /semi/i.test(style) ? "Semi Bold" : "Regular" };
      try {
        await figma.loadFontAsync(fb);
      } catch {
        fb.style = "Regular";
        await figma.loadFontAsync(fb);
      }
      return fb;
    }
  }
  async function createKit(theme) {
    const t = { ...DEFAULT_THEME, ...theme };
    for (const role of colorRoles(t)) {
      const existing = (await figma.getLocalPaintStylesAsync()).find((s2) => s2.name === role.name);
      const s = existing || figma.createPaintStyle();
      s.name = role.name;
      s.paints = [solid(hexToRGB(role.hex))];
    }
    for (const ts of typeScale(16)) {
      const f = await font(t.fontFamily, ts.weight);
      const existing = (await figma.getLocalTextStylesAsync()).find((s2) => s2.name === `${t.fontFamily}/${ts.name}`);
      const s = existing || figma.createTextStyle();
      s.name = `${t.fontFamily}/${ts.name}`;
      s.fontName = f;
      s.fontSize = ts.size;
    }
    const specs = buildKit(t);
    const page = figma.createFrame();
    page.name = "sinhaankur Kit \u2014 Components";
    page.layoutMode = "HORIZONTAL";
    page.layoutWrap = "WRAP";
    page.itemSpacing = 24;
    page.counterAxisSpacing = 24;
    page.paddingTop = page.paddingBottom = page.paddingLeft = page.paddingRight = 40;
    page.fills = [solid(hexToRGB(t.bg))];
    page.resize(920, 600);
    page.counterAxisSizingMode = "AUTO";
    page.primaryAxisSizingMode = "AUTO";
    page.x = figma.viewport.center.x - 460;
    page.y = figma.viewport.center.y - 300;
    let made = 0;
    for (const spec of specs) {
      await buildComponent(spec, t, page);
      made++;
      figma.ui.postMessage({ type: "progress", done: made, total: specs.length });
    }
    figma.currentPage.selection = [page];
    figma.viewport.scrollAndZoomIntoView([page]);
    figma.notify(`Created ${made} components + ${colorRoles(t).length} color & ${typeScale(16).length} text styles \u2728`);
    figma.ui.postMessage({ type: "kit-done", components: made });
  }
  async function buildComponent(spec, t, parent) {
    var _a;
    const comp = figma.createComponent();
    comp.name = spec.name;
    comp.resize(spec.w, spec.h);
    comp.cornerRadius = (_a = spec.radius) != null ? _a : 0;
    comp.fills = spec.fill && spec.fill !== "transparent" ? [solid(hexToRGB(spec.fill))] : [];
    if (spec.stroke) {
      comp.strokes = [solid(hexToRGB(spec.stroke))];
      comp.strokeWeight = spec.strokeW || 1;
    }
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.paddingLeft = comp.paddingRight = spec.pad || 0;
    if (spec.text) {
      const f = await font(t.fontFamily, spec.text.weight);
      const txt = figma.createText();
      txt.fontName = f;
      txt.characters = spec.text.value;
      txt.fontSize = spec.text.size;
      txt.fills = [solid(hexToRGB(spec.text.color))];
      if (spec.text.align) txt.textAlignHorizontal = spec.text.align;
      comp.appendChild(txt);
    }
    parent.appendChild(comp);
  }
  function toRGB(p) {
    var _a;
    if (p.type !== "SOLID" || p.visible === false) return null;
    return { r: p.color.r, g: p.color.g, b: p.color.b, a: (_a = p.opacity) != null ? _a : 1 };
  }
  function descNode(node) {
    const fills = [];
    let bound = false;
    if ("fills" in node && node.fills !== figma.mixed) for (const p of node.fills) {
      const c = toRGB(p);
      if (c) fills.push(c);
    }
    if ("fillStyleId" in node && node.fillStyleId) bound = true;
    const d = {
      id: node.id,
      name: node.name,
      type: node.type,
      fills,
      boundColorStyle: bound,
      width: "width" in node ? node.width : void 0,
      height: "height" in node ? node.height : void 0,
      isInteractive: /\b(button|btn|cta|link|tab|chip|toggle)\b/i.test(node.name)
    };
    if (node.type === "TEXT") {
      const tn = node;
      d.fontSize = typeof tn.fontSize === "number" ? tn.fontSize : 16;
      d.characters = tn.characters;
      d.bgColor = bgBehind(node);
    }
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      const f = node;
      d.paddings = [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft];
      d.itemSpacing = f.itemSpacing;
    }
    return d;
  }
  function bgBehind(node) {
    let p = node.parent;
    while (p && "fills" in p) {
      const f = p.fills;
      if (Array.isArray(f)) for (const paint of f) {
        const c = toRGB(paint);
        if (c) return c;
      }
      p = p.parent;
    }
    return null;
  }
  function runAudit(scope, opts) {
    const roots = scope === "selection" && figma.currentPage.selection.length ? figma.currentPage.selection : figma.currentPage.children;
    const descs = [];
    const visit = (n) => {
      descs.push(descNode(n));
      if ("children" in n) for (const c of n.children) visit(c);
    };
    for (const r of roots) visit(r);
    const findings = auditNodes(descs, opts);
    figma.ui.postMessage({ type: "audit-result", findings, summary: summarize(findings), scanned: descs.length });
  }
  async function runLibraryAudit() {
    const comps = [];
    const walk = (n) => {
      var _a, _b;
      if (n.type === "COMPONENT") comps.push({ id: n.id, name: n.name, isVariant: ((_a = n.parent) == null ? void 0 : _a.type) === "COMPONENT_SET", setName: ((_b = n.parent) == null ? void 0 : _b.type) === "COMPONENT_SET" ? n.parent.name : void 0 });
      if (n.type === "COMPONENT_SET") comps.push({ id: n.id, name: n.name, isVariant: false });
      if ("children" in n) for (const c of n.children) walk(c);
    };
    for (const p of figma.currentPage.children) walk(p);
    const issues = auditLibrary(comps);
    figma.ui.postMessage({ type: "library-result", issues, summary: summarizeLibrary(comps, issues), structure: proposeStructure(comps) });
  }
  async function readStyleSet() {
    var _a;
    const colors = [];
    for (const s of await figma.getLocalPaintStylesAsync()) {
      const p = s.paints.find((x) => x.type === "SOLID");
      if (p) colors.push({ name: s.name, color: { r: p.color.r, g: p.color.g, b: p.color.b, a: (_a = p.opacity) != null ? _a : 1 } });
    }
    const text = [];
    for (const s of await figma.getLocalTextStylesAsync()) text.push({ name: s.name, fontFamily: s.fontName.family, fontStyle: s.fontName.style, fontSize: s.fontSize });
    return { colors, text, spacing: [] };
  }
  async function tokensExport(prefix) {
    const set = await readStyleSet();
    figma.ui.postMessage({ type: "tokens-result", json: JSON.stringify(toTokensJSON(set), null, 2), css: toCSSVars(set, prefix), counts: { colors: set.colors.length, text: set.text.length } });
  }
  async function tokensImport(jsonStr) {
    const set = fromTokensJSON(JSON.parse(jsonStr));
    const existing = await figma.getLocalPaintStylesAsync();
    const byName = new Map(existing.map((s) => [s.name, s]));
    let created = 0, updated = 0;
    for (const c of set.colors) {
      const paint = solid(c.color);
      const s = byName.get(c.name);
      if (s) {
        s.paints = [paint];
        updated++;
      } else {
        const ns = figma.createPaintStyle();
        ns.name = c.name;
        ns.paints = [paint];
        created++;
      }
    }
    figma.ui.postMessage({ type: "tokens-imported", created, updated });
  }
  async function fillContent(mode, seed) {
    const nodes = [];
    const visit = (n) => {
      if (n.type === "TEXT") nodes.push(n);
      if ("children" in n) for (const c of n.children) visit(c);
    };
    for (const n of figma.currentPage.selection) visit(n);
    if (!nodes.length) {
      figma.notify("Select some text layers first.");
      return;
    }
    let filled = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      try {
        const f = node.fontName;
        if (f !== figma.mixed) await figma.loadFontAsync(f);
        else await figma.loadFontAsync(node.getRangeFontName(0, 1));
      } catch {
        continue;
      }
      const type = mode === "auto" ? detectSmart(node.name, node.characters.length) : mode;
      node.characters = generate(type, seed + i * 101 + node.name.length);
      filled++;
    }
    figma.notify(`Filled ${filled} text layers`);
    figma.ui.postMessage({ type: "filled", n: filled });
  }
  async function htmlImport(tree) {
    const page = figma.createFrame();
    page.name = tree.name || "Imported";
    page.resize(Math.max(1, tree.w), Math.max(1, tree.h));
    page.x = figma.viewport.center.x - tree.w / 2;
    page.y = figma.viewport.center.y - tree.h / 2;
    page.fills = tree.fill ? [solid(tree.fill)] : [];
    page.clipsContent = true;
    const ox = page.x, oy = page.y;
    const add = async (n) => {
      if (n.kind === "text" && n.text) {
        const f = await font(n.fontFamily || "Inter", n.fontStyle || "Regular");
        const t = figma.createText();
        t.fontName = f;
        t.characters = n.text;
        t.fontSize = Math.max(1, n.fontSize || 16);
        t.x = ox + n.x;
        t.y = oy + n.y;
        if (n.color) t.fills = [solid(n.color)];
        page.appendChild(t);
      } else {
        const r = figma.createRectangle();
        r.x = ox + n.x;
        r.y = oy + n.y;
        r.resize(Math.max(1, n.w), Math.max(1, n.h));
        r.fills = n.fill ? [solid(n.fill)] : [];
        if (n.stroke && n.strokeWidth) {
          r.strokes = [solid(n.stroke)];
          r.strokeWeight = n.strokeWidth;
        }
        if (n.radius) r.cornerRadius = n.radius;
        page.appendChild(r);
      }
      if (n.children) for (const c of n.children) await add(c);
    };
    for (const c of tree.children || []) await add(c);
    figma.currentPage.selection = [page];
    figma.viewport.scrollAndZoomIntoView([page]);
    figma.ui.postMessage({ type: "html-done", count: (tree.children || []).length });
  }
  async function devExport(prefix) {
    const set = await readStyleSet();
    const comps = [];
    const walk = (n) => {
      if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") comps.push(n.name);
      if ("children" in n) for (const c of n.children) walk(c);
    };
    for (const p of figma.currentPage.children) walk(p);
    figma.ui.postMessage({
      type: "dev-bundle",
      tokensJson: JSON.stringify(toTokensJSON(set), null, 2),
      tokensCss: toCSSVars(set, prefix),
      components: comps
    });
  }
  function selectNode(id) {
    const n = figma.getNodeById(id);
    if (n && "visible" in n) {
      figma.currentPage.selection = [n];
      figma.viewport.scrollAndZoomIntoView([n]);
    }
  }
})();
