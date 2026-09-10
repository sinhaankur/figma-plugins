"use strict";
(() => {
  // src/data-core.ts
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
  figma.showUI(__html__, { width: 380, height: 520, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "close") return figma.closePlugin();
    if (msg.type === "count") return sendCount();
    if (msg.type === "fill") return fill(msg.mode, msg.seed);
  };
  function textNodesInSelection() {
    const out = [];
    const visit = (n) => {
      if (n.type === "TEXT") out.push(n);
      if ("children" in n) for (const c of n.children) visit(c);
    };
    for (const n of figma.currentPage.selection) visit(n);
    return out;
  }
  function sendCount() {
    figma.ui.postMessage({ type: "count", n: textNodesInSelection().length });
  }
  async function fill(mode, baseSeed) {
    const nodes = textNodesInSelection();
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
        else {
          await figma.loadFontAsync(node.getRangeFontName(0, 1));
        }
      } catch {
        continue;
      }
      const type = mode === "auto" ? detectSmart(node.name, node.characters.length) : mode;
      node.characters = generate(type, baseSeed + i * 101 + node.name.length);
      filled++;
    }
    figma.notify(`Filled ${filled} text layer${filled === 1 ? "" : "s"}`);
    figma.ui.postMessage({ type: "filled", n: filled });
  }
  figma.on("selectionchange", sendCount);
  sendCount();
})();
