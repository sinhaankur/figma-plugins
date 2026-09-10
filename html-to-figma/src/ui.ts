// ui.ts — the HTML→Figma engine. Renders the pasted HTML (or a fetched URL's HTML)
// into a hidden, sized iframe, then walks the DOM reading getComputedStyle +
// getBoundingClientRect for every element, producing a FigmaNode tree that the
// sandbox turns into editable Figma layers. On-device.
//
// © Ankur Sinha.

import {
  parseColor, px, parseRadius, fontStyleName, textAlign, isRenderable, hasVisibleBox,
  type FigmaNode, type RGBA,
} from "./css-core";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = el<HTMLIFrameElement>("stage");
const status = el("status");
let mode: "html" | "url" = "html";

el("tabHtml").addEventListener("click", () => setMode("html"));
el("tabUrl").addEventListener("click", () => setMode("url"));
function setMode(m: "html" | "url") {
  mode = m;
  el("tabHtml").classList.toggle("on", m === "html");
  el("tabUrl").classList.toggle("on", m === "url");
  el("htmlPane").classList.toggle("hidden", m !== "html");
  el("urlPane").classList.toggle("hidden", m !== "url");
}

// width preset pills
document.querySelectorAll<HTMLElement>(".pill").forEach((pill) =>
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("on"));
    pill.classList.add("on");
    (el<HTMLInputElement>("width")).value = pill.dataset.w!;
  }));

el("go").addEventListener("click", run);

async function run() {
  let html = "";
  if (mode === "html") {
    html = (el<HTMLTextAreaElement>("html")).value.trim();
    if (!html) { status.textContent = "Paste some HTML first."; return; }
  } else {
    const url = (el<HTMLInputElement>("url")).value.trim();
    if (!url) { status.textContent = "Enter a URL."; return; }
    status.textContent = "Fetching page…";
    try {
      const res = await fetch(url, { mode: "cors" });
      html = await res.text();
      html = absolutize(html, url); // best-effort fix relative asset URLs
    } catch (e: any) {
      status.textContent = "Couldn't fetch (CORS?). Paste the HTML instead."; return;
    }
  }
  status.textContent = "Rendering…";
  const width = px((el<HTMLInputElement>("width")).value || "1056") || 1056;
  await renderAndWalk(html, width);
}

function absolutize(html: string, base: string): string {
  try {
    const b = new URL(base);
    return html.replace(/(src|href)=["'](?!https?:|data:|#)([^"']+)["']/gi,
      (_m, attr, path) => `${attr}="${new URL(path, b).href}"`);
  } catch { return html; }
}

async function renderAndWalk(html: string, width: number) {
  const doc = stage.contentDocument!;
  stage.style.width = width + "px";
  doc.open(); doc.write(html); doc.close();

  // wait for layout + fonts/images
  await new Promise((r) => setTimeout(r, 350));
  try { await (doc as any).fonts?.ready; } catch {}

  const body = doc.body;
  const root: FigmaNode = {
    kind: "frame", name: "Imported page", x: 0, y: 0,
    w: width, h: Math.max(body.scrollHeight, 1),
    fill: parseColor(getComputedStyle(body).backgroundColor) || { r: 1, g: 1, b: 1, a: 1 },
    children: [],
  };

  const nodes: FigmaNode[] = [];
  walk(body, doc, nodes);
  root.children = nodes;

  status.textContent = "Building Figma layers…";
  parent.postMessage({ pluginMessage: { type: "import", tree: root } }, "*");
}

// Walk visible elements; emit a box node for painted elements and a text node for
// text-bearing leaf elements. Positions are absolute page coords.
function walk(node: Element, doc: Document, out: FigmaNode[]) {
  for (const child of Array.from(node.children)) {
    const style = getComputedStyle(child);
    const rect = child.getBoundingClientRect();
    const win = doc.defaultView!;
    const x = rect.left + win.scrollX, y = rect.top + win.scrollY;
    const w = rect.width, h = rect.height;

    if (!isRenderable({ display: style.display, visibility: style.visibility, opacity: style.opacity, width: w, height: h })) {
      continue;
    }

    const bg = parseColor(style.backgroundColor);
    const border = parseColor(style.borderTopColor);
    const bw = px(style.borderTopWidth);
    const radius = parseRadius(style.borderTopLeftRadius);

    // image element → image node (bytes captured in code via <img> re-fetch not
    // possible in sandbox; we place a rect with the border as a placeholder marker,
    // and keep the box). Real image capture would need canvas drawImage — added
    // when same-origin.
    const tag = child.tagName.toLowerCase();

    // box (frame/rect) if it paints anything
    if (hasVisibleBox(bg, bw > 0 ? border : null, radius)) {
      out.push({
        kind: "rect", name: tag + (child.id ? "#" + child.id : ""),
        x, y, w, h, fill: bg, stroke: bw > 0 ? border : null, strokeWidth: bw,
        radius, opacity: parseFloat(style.opacity),
      });
    }

    // direct text (only the element's own text, not descendants')
    const ownText = directText(child);
    if (ownText) {
      out.push({
        kind: "text", name: ownText.slice(0, 40), x, y, w, h,
        text: ownText,
        fontSize: px(style.fontSize) || 16,
        fontFamily: (style.fontFamily.split(",")[0] || "Inter").replace(/["']/g, "").trim(),
        fontStyle: fontStyleName(style.fontWeight, style.fontStyle === "italic"),
        color: parseColor(style.color),
        align: textAlign(style.textAlign),
        lineHeight: style.lineHeight.endsWith("px") ? px(style.lineHeight) : undefined,
        letterSpacing: style.letterSpacing.endsWith("px") ? px(style.letterSpacing) : undefined,
      });
    }

    // recurse
    walk(child, doc, out);
  }
}

// Concatenate only the direct text node children (ignoring nested elements).
function directText(el: Element): string {
  let s = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) s += n.textContent || "";
  }
  return s.replace(/\s+/g, " ").trim();
}

onmessage = (e: MessageEvent) => {
  const m = e.data.pluginMessage; if (!m) return;
  if (m.type === "done") status.textContent = `Imported ${m.count} layers ✓`;
  if (m.type === "progress") status.textContent = `Building… ${m.done}/${m.total}`;
};
