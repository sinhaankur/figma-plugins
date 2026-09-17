// bookmarklet.js — "Send to Figma" — runs in YOUR real browser on the fully
// rendered page (so all CSS, fonts, JS-built DOM and images are live), walks the
// DOM reading getComputedStyle + getBoundingClientRect, captures images/backgrounds
// as data URLs, and copies a FigmaNode-tree JSON to the clipboard. Then in Figma:
// HTML→Figma → "Receive" → paste → editable layers.
//
// This is the reliable path: Figma's plugin sandbox can't run an arbitrary page's
// scripts (so bundler/SPA pages never render there). Serializing from the real
// browser sidesteps all of that.
//
// Build: `node build.mjs` minifies this into dist/bookmarklet.txt (the javascript:
// URL you drag to your bookmarks bar). © Ankur Sinha.

(async function () {
  "use strict";
  var MAX_IMG = 2000; // cap captured image dimension (perf)

  function toast(msg, ok) {
    var t = document.getElementById("__f2f_toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__f2f_toast";
      t.style.cssText =
        "position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);" +
        "background:#16181f;color:#f3f4f6;font:13px/1.4 -apple-system,system-ui,sans-serif;" +
        "padding:12px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.45);" +
        "border:1px solid rgba(255,255,255,.1);max-width:80vw";
      document.body.appendChild(t);
    }
    t.style.borderColor = ok ? "rgba(52,211,153,.5)" : "rgba(255,255,255,.1)";
    t.textContent = msg;
  }

  // ── CSS → values (mirror of css-core.ts, inlined so the bookmarklet is standalone) ──
  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  function pxn(v) { var n = parseFloat(String(v).replace("px", "")); return isFinite(n) ? n : 0; }
  function parseColor(css) {
    if (!css) return null;
    var s = css.trim().toLowerCase();
    if (s === "transparent" || s === "none") return null;
    var m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(/[,\/\s]+/).filter(Boolean);
      var a = p[3] != null ? clamp01(parseFloat(p[3])) : 1;
      if (a === 0) return null;
      return { r: clamp01(+p[0] / 255), g: clamp01(+p[1] / 255), b: clamp01(+p[2] / 255), a: a };
    }
    m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      var h = m[1], to = function (i, l) { return parseInt(l === 1 ? h[i] + h[i] : h.slice(i, i + 2), 16) / 255; };
      if (h.length === 3) return { r: to(0, 1), g: to(1, 1), b: to(2, 1), a: 1 };
      if (h.length === 6) return { r: to(0, 2), g: to(2, 2), b: to(4, 2), a: 1 };
      if (h.length === 8) { var a2 = to(6, 2); return a2 === 0 ? null : { r: to(0, 2), g: to(2, 2), b: to(4, 2), a: a2 }; }
    }
    return null;
  }
  function fontStyleName(weight, italic) {
    var w = parseInt(weight, 10) || 400;
    var base = w >= 800 ? "Black" : w >= 700 ? "Bold" : w >= 600 ? "SemiBold" : w >= 500 ? "Medium" : w <= 300 ? "Light" : "Regular";
    return italic ? (base === "Regular" ? "Italic" : base + " Italic") : base;
  }
  function textAlign(css) {
    switch ((css || "").toLowerCase()) {
      case "center": return "CENTER";
      case "right": case "end": return "RIGHT";
      case "justify": return "JUSTIFIED";
      default: return "LEFT";
    }
  }
  function parseRadius(css) { return Math.max(0, pxn((css || "0").split(/\s+/)[0])); }
  function parseShadow(css) {
    if (!css || css === "none") return null;
    var color = parseColor(css) || { r: 0, g: 0, b: 0, a: 0.25 };
    var nums = css.match(/-?[\d.]+px/g);
    if (!nums || nums.length < 2) return null;
    var v = nums.map(function (n) { return parseFloat(n); });
    return { x: v[0], y: v[1], blur: v[2] || 0, spread: v[3] || 0, color: color };
  }

  // ── image capture (draw to canvas → dataURL; same-origin & crossorigin-ok imgs) ──
  function imgToDataURL(imgOrUrl, w, h) {
    return new Promise(function (resolve) {
      try {
        var img;
        if (typeof imgOrUrl === "string") {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = draw;
          img.onerror = function () { resolve(null); };
          img.src = imgOrUrl;
        } else {
          img = imgOrUrl;
          if (img.complete && img.naturalWidth) draw(); else { img.onload = draw; img.onerror = function () { resolve(null); }; }
        }
        function draw() {
          try {
            var nw = img.naturalWidth || w, nh = img.naturalHeight || h;
            var scale = Math.min(1, MAX_IMG / Math.max(nw, nh));
            var cw = Math.max(1, Math.round(nw * scale)), ch = Math.max(1, Math.round(nh * scale));
            var c = document.createElement("canvas"); c.width = cw; c.height = ch;
            c.getContext("2d").drawImage(img, 0, 0, cw, ch);
            resolve(c.toDataURL("image/png"));
          } catch (e) { resolve(null); } // tainted canvas → skip
        }
      } catch (e) { resolve(null); }
    });
  }
  function bgImageURL(style) {
    var bi = style.backgroundImage;
    if (!bi || bi === "none") return null;
    var m = bi.match(/url\(["']?([^"')]+)["']?\)/i);
    return m ? m[1] : null; // gradients ignored (return null)
  }

  // ── walk ──────────────────────────────────────────────────────────────────────
  var scrollX = window.scrollX, scrollY = window.scrollY;
  var jobs = []; // async image jobs to await

  function directText(el) {
    var s = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) s += n.textContent || "";
    }
    return s.replace(/\s+/g, " ").trim();
  }

  function walk(node, out) {
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      var tag = child.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "template") continue;
      if (child.id === "__f2f_toast") continue; // don't capture our own status toast
      var st = getComputedStyle(child);
      if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) === 0) continue;
      var rect = child.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      if (w <= 0 || h <= 0) continue;
      var x = rect.left + scrollX, y = rect.top + scrollY;

      var bg = parseColor(st.backgroundColor);
      var bw = pxn(st.borderTopWidth);
      var border = bw > 0 ? parseColor(st.borderTopColor) : null;
      var radius = parseRadius(st.borderTopLeftRadius);
      var shadow = parseShadow(st.boxShadow);
      var opacity = parseFloat(st.opacity);

      // <img> → image node
      if (tag === "img" && child.src) {
        (function (cx, cy, cw, ch, nm, rad, op) {
          jobs.push(imgToDataURL(child, cw, ch).then(function (durl) {
            out.push({ kind: durl ? "image" : "rect", name: "img" + (nm ? "#" + nm : ""),
              x: cx, y: cy, w: cw, h: ch, radius: rad, opacity: op,
              fill: durl ? null : { r: .85, g: .85, b: .87, a: 1 }, imageDataURL: durl || undefined });
          }));
        })(x, y, w, h, child.id, radius, opacity);
        continue; // img has no child elements worth walking
      }

      // background-image → image node behind the box
      var bgUrl = bgImageURL(st);
      if (bgUrl) {
        (function (cx, cy, cw, ch, rad, op, url) {
          jobs.push(imgToDataURL(url, cw, ch).then(function (durl) {
            if (durl) out.push({ kind: "image", name: "bg", x: cx, y: cy, w: cw, h: ch, radius: rad, opacity: op, imageDataURL: durl });
          }));
        })(x, y, w, h, radius, opacity, bgUrl);
      }

      // painted box (fill/border/radius/shadow)
      if (bg || border || radius > 0 || shadow) {
        out.push({ kind: "rect", name: tag + (child.id ? "#" + child.id : ""),
          x: x, y: y, w: w, h: h, fill: bg || null, stroke: border, strokeWidth: bw,
          radius: radius, opacity: opacity, shadow: shadow });
      }

      // own text
      var txt = directText(child);
      if (txt) {
        out.push({ kind: "text", name: txt.slice(0, 40), x: x, y: y, w: w, h: h, text: txt,
          fontSize: pxn(st.fontSize) || 16,
          fontFamily: (st.fontFamily.split(",")[0] || "Inter").replace(/["']/g, "").trim(),
          fontStyle: fontStyleName(st.fontWeight, st.fontStyle === "italic"),
          color: parseColor(st.color),
          align: textAlign(st.textAlign),
          lineHeight: /px$/.test(st.lineHeight) ? pxn(st.lineHeight) : undefined,
          letterSpacing: /px$/.test(st.letterSpacing) ? pxn(st.letterSpacing) : undefined,
          opacity: opacity });
      }

      walk(child, out);
    }
  }

  toast("Capturing page…");
  var body = document.body;
  var bodyBg = parseColor(getComputedStyle(body).backgroundColor) || { r: 1, g: 1, b: 1, a: 1 };
  var pageW = Math.max(document.documentElement.scrollWidth, body.scrollWidth, window.innerWidth);
  var pageH = Math.max(document.documentElement.scrollHeight, body.scrollHeight);
  var kids = [];
  walk(body, kids);
  toast("Fetching " + jobs.length + " images…");
  await Promise.all(jobs);

  var tree = { kind: "frame", name: (document.title || "Imported page").slice(0, 60),
    x: 0, y: 0, w: pageW, h: pageH, fill: bodyBg, children: kids };

  var payload = JSON.stringify({ __f2f: 1, tree: tree });

  // Copy to clipboard (with fallback to a selectable textarea).
  try {
    await navigator.clipboard.writeText(payload);
    toast("✓ Copied " + kids.length + " layers. In Figma: HTML→Figma → Receive → Paste (⌘V).", true);
  } catch (e) {
    var ta = document.createElement("textarea");
    ta.value = payload;
    ta.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:60vw;height:40vh";
    document.body.appendChild(ta); ta.select();
    toast("Select-all + copy this box, then paste into Figma → Receive.", true);
  }
})();
