// code.js — HTML to Figma (sandbox). Receives a parsed DOM tree from the UI and
// builds Figma layers: frames, text, images, with fills, borders, radius, opacity
// and drop shadows. Plain JS, no build step. © Ankur Sinha.

figma.showUI(__html__, { width: 380, height: 480, themeColors: true });

figma.ui.onmessage = async function (msg) {
  if (msg.type === "resize" && typeof msg.height === "number") {
    figma.ui.resize(380, Math.max(120, Math.min(900, Math.round(msg.height))));
    return;
  }
  if (msg.type === "convert" && msg.tree) {
    await convert(msg.tree);
  }
};

async function convert(tree) {
  figma.notify("Converting HTML to Figma…", { timeout: 2000 });

  var wrapper = figma.createFrame();
  wrapper.name = "HTML Import";
  wrapper.resize(Math.max(1, tree.width), Math.max(1, tree.height));
  wrapper.clipsContent = false;
  var bg = parseColor(tree.styles && tree.styles.backgroundColor);
  wrapper.fills = bg ? [{ type: "SOLID", color: bg }] : [];

  var c = figma.viewport.center;
  wrapper.x = Math.round(c.x - tree.width / 2);
  wrapper.y = Math.round(c.y - tree.height / 2);

  // children are positioned relative to the wrapper's page origin
  for (var i = 0; i < (tree.children || []).length; i++) {
    await build(tree.children[i], wrapper, tree.x, tree.y);
  }

  figma.currentPage.appendChild(wrapper);
  figma.currentPage.selection = [wrapper];
  figma.viewport.scrollAndZoomIntoView([wrapper]);
  figma.notify("HTML imported ✓");
}

// build a node into `parent`. ox/oy = the page-coord origin (root's x/y) so we
// convert absolute rects into wrapper-relative coordinates.
async function build(node, parent, ox, oy) {
  var s = node.styles || {};
  if (s.display === "none" || s.visibility === "hidden") return;
  if (node.width <= 0 && node.height <= 0 && !node.text) return;

  // TEXT
  if (node.tag === "#text" && node.text) {
    await loadFont(s.fontWeight);
    var t = figma.createText();
    t.fontName = fontFor(s.fontWeight);
    t.characters = node.text;
    t.fontSize = Math.max(1, Math.round(parseFloat(s.fontSize) || 14));
    var col = parseColor(s.color); if (col) t.fills = [{ type: "SOLID", color: col }];
    if (s.textAlign === "center") t.textAlignHorizontal = "CENTER";
    else if (s.textAlign === "right") t.textAlignHorizontal = "RIGHT";
    t.x = node.x - ox; t.y = node.y - oy;
    if (node.width > 0) { t.resize(Math.max(1, node.width), Math.max(1, node.height || 20)); t.textAutoResize = "HEIGHT"; }
    parent.appendChild(t);
    return;
  }

  // IMAGE
  if (node.tag === "img" && node.imageBytes && node.imageBytes.length) {
    try {
      var image = figma.createImage(new Uint8Array(node.imageBytes));
      var r = figma.createRectangle();
      r.name = "image"; r.x = node.x - ox; r.y = node.y - oy;
      r.resize(Math.max(1, node.width), Math.max(1, node.height));
      r.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
      var rad0 = parseFloat(s.borderRadius) || 0; if (rad0) r.cornerRadius = Math.round(rad0);
      parent.appendChild(r);
      return;
    } catch (e) { /* fall through to a box */ }
  }

  // BOX (frame)
  var f = figma.createFrame();
  f.name = node.tag || "div";
  f.resize(Math.max(1, node.width), Math.max(1, node.height));
  f.x = node.x - ox; f.y = node.y - oy;

  var boxBg = parseColor(s.backgroundColor);
  f.fills = boxBg && !isTransparent(s.backgroundColor) ? [{ type: "SOLID", color: boxBg, opacity: alpha(s.backgroundColor) }] : [];

  var rad = parseFloat(s.borderRadius) || 0; if (rad) f.cornerRadius = Math.round(rad);

  var bw = parseFloat(s.borderWidth) || 0;
  if (bw > 0) { var bc = parseColor(s.borderColor); if (bc) { f.strokes = [{ type: "SOLID", color: bc }]; f.strokeWeight = Math.max(1, Math.round(bw)); } }

  var op = parseFloat(s.opacity); if (!isNaN(op) && op < 1) f.opacity = op;

  var sh = parseShadow(s.boxShadow);
  if (sh) f.effects = [{ type: "DROP_SHADOW", visible: true, blendMode: "NORMAL", color: sh.color, offset: { x: sh.x, y: sh.y }, radius: sh.blur, spread: sh.spread }];

  f.clipsContent = true;
  parent.appendChild(f);

  // children relative to this frame
  for (var i = 0; i < (node.children || []).length; i++) {
    await build(node.children[i], f, node.x, node.y);
  }
}

// ── fonts ──────────────────────────────────────────────────────────────────────
var fontsLoaded = {};
function fontFor(weight) {
  var bold = weight && (parseInt(weight, 10) >= 700 || weight === "bold");
  return { family: "Inter", style: bold ? "Bold" : "Regular" };
}
async function loadFont(weight) {
  var f = fontFor(weight); var k = f.family + f.style;
  if (fontsLoaded[k]) return;
  try { await figma.loadFontAsync(f); fontsLoaded[k] = true; }
  catch (e) { var fb = { family: "Inter", style: "Regular" }; await figma.loadFontAsync(fb); fontsLoaded["InterRegular"] = true; }
}

// ── css value parsers ───────────────────────────────────────────────────────────
function parseColor(css) {
  if (!css) return null;
  var m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255 };
  var h = css.match(/#([0-9a-fA-F]{3,8})/);
  if (h) { var x = h[1]; if (x.length === 3) x = x[0]+x[0]+x[1]+x[1]+x[2]+x[2]; return { r: parseInt(x.slice(0,2),16)/255, g: parseInt(x.slice(2,4),16)/255, b: parseInt(x.slice(4,6),16)/255 }; }
  return null;
}
function alpha(css) { var m = css && css.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/); return m ? parseFloat(m[1]) : 1; }
function isTransparent(css) { return !css || css === "transparent" || (css.indexOf("rgba") > -1 && alpha(css) === 0); }
function parseShadow(css) {
  if (!css || css === "none") return null;
  var nums = css.match(/-?[\d.]+px/g); if (!nums || nums.length < 2) return null;
  var v = nums.map(function (n) { return parseFloat(n); });
  var col = parseColor(css) || { r: 0, g: 0, b: 0 };
  return { x: v[0], y: v[1], blur: v[2] || 0, spread: v[3] || 0, color: { r: col.r, g: col.g, b: col.b, a: alpha(css) || 0.25 } };
}
