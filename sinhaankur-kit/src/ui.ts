// ui.ts — sinhaankur Kit UI: home menu + per-tool panels + the HTML DOM walker.
// © Ankur Sinha.

import {
  parseColor, px, parseRadius, fontStyleName, textAlign, isRenderable, hasVisibleBox, type FigmaNode,
} from "./cores/css-core";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const PANELS = ["home", "kit", "audit", "library", "tokens", "content", "html", "dev"];
function show(id: string) { for (const p of PANELS) el(p).classList.toggle("hidden", p !== id); }

document.querySelectorAll<HTMLElement>("[data-go]").forEach((t) => t.addEventListener("click", () => show(t.dataset.go!)));
document.querySelectorAll<HTMLElement>("[data-home]").forEach((b) => b.addEventListener("click", () => show("home")));
const post = (m: any) => parent.postMessage({ pluginMessage: m }, "*");

// ── KIT ─────────────────────────────────────────────────────────────────────
el("kGo").addEventListener("click", () => {
  el("kStatus").textContent = "Building…";
  post({ type: "create-kit", theme: {
    accent: (el<HTMLInputElement>("kAccent")).value, fg: (el<HTMLInputElement>("kFg")).value,
    bg: (el<HTMLInputElement>("kBg")).value, muted: (el<HTMLInputElement>("kMuted")).value,
    fontFamily: (el<HTMLInputElement>("kFont")).value || "Inter",
    radius: parseInt((el<HTMLInputElement>("kRadius")).value) || 10,
  } });
});

// ── AUDIT ───────────────────────────────────────────────────────────────────
let aScope: "page" | "selection" = "page";
el("aPage").addEventListener("click", () => { aScope = "page"; el("aPage").classList.add("on"); el("aSel").classList.remove("on"); });
el("aSel").addEventListener("click", () => { aScope = "selection"; el("aSel").classList.add("on"); el("aPage").classList.remove("on"); });
el("aGo").addEventListener("click", () => { el("aOut").innerHTML = `<div class="status">Scanning…</div>`; post({ type: "audit", scope: aScope, opts: {} }); });

// ── LIBRARY ─────────────────────────────────────────────────────────────────
el("lGo").addEventListener("click", () => { el("lOut").innerHTML = `<div class="status">Scanning…</div>`; post({ type: "audit-library" }); });

// ── TOKENS ──────────────────────────────────────────────────────────────────
let tFmt: "json" | "css" = "json"; let tJson = "", tCss = "";
el("tExport").addEventListener("click", () => { el("tExport").classList.add("on"); el("tImport").classList.remove("on"); el("tExportPane").classList.remove("hidden"); el("tImportPane").classList.add("hidden"); });
el("tImport").addEventListener("click", () => { el("tImport").classList.add("on"); el("tExport").classList.remove("on"); el("tImportPane").classList.remove("hidden"); el("tExportPane").classList.add("hidden"); });
el("fJson").addEventListener("click", () => { tFmt = "json"; el("fJson").classList.add("on"); el("fCss").classList.remove("on"); (el<HTMLTextAreaElement>("tOut")).value = tJson; });
el("fCss").addEventListener("click", () => { tFmt = "css"; el("fCss").classList.add("on"); el("fJson").classList.remove("on"); (el<HTMLTextAreaElement>("tOut")).value = tCss; });
el("tGo").addEventListener("click", () => { el("tStatus").textContent = "Reading…"; post({ type: "tokens-export", prefix: (el<HTMLInputElement>("tPrefix")).value.trim() }); });
el("tImportGo").addEventListener("click", () => post({ type: "tokens-import", json: (el<HTMLTextAreaElement>("tIn")).value.trim() }));
el("tCopy").addEventListener("click", () => copy((el<HTMLTextAreaElement>("tOut")).value, "tStatus"));

// ── CONTENT ─────────────────────────────────────────────────────────────────
let cMode = "auto"; let cSeed = rnd();
el("cPills").querySelectorAll<HTMLElement>(".pill").forEach((p) => p.addEventListener("click", () => { el("cPills").querySelectorAll(".pill").forEach((x) => x.classList.remove("on")); p.classList.add("on"); cMode = p.dataset.m!; }));
el("cGo").addEventListener("click", () => { cSeed = rnd(); el("cStatus").textContent = "Filling…"; post({ type: "fill", mode: cMode, seed: cSeed }); });
el("cShuffle").addEventListener("click", () => { cSeed = rnd(); post({ type: "fill", mode: cMode, seed: cSeed }); });

// ── HTML ────────────────────────────────────────────────────────────────────
let hMode: "html" | "url" = "html";
el("hHtml").addEventListener("click", () => { hMode = "html"; el("hHtml").classList.add("on"); el("hUrl").classList.remove("on"); el("hHtmlPane").classList.remove("hidden"); el("hUrlPane").classList.add("hidden"); });
el("hUrl").addEventListener("click", () => { hMode = "url"; el("hUrl").classList.add("on"); el("hHtml").classList.remove("on"); el("hUrlPane").classList.remove("hidden"); el("hHtmlPane").classList.add("hidden"); });
el("hGo").addEventListener("click", runHtml);

async function runHtml() {
  let html = "";
  if (hMode === "html") { html = (el<HTMLTextAreaElement>("hHtmlIn")).value.trim(); if (!html) { el("hStatus").textContent = "Paste HTML first."; return; } }
  else { const u = (el<HTMLInputElement>("hUrlIn")).value.trim(); if (!u) { el("hStatus").textContent = "Enter a URL."; return; } el("hStatus").textContent = "Fetching…"; try { const r = await fetch(u, { mode: "cors" }); html = absolutize(await r.text(), u); } catch { el("hStatus").textContent = "Fetch blocked — paste HTML instead."; return; } }
  el("hStatus").textContent = "Rendering…";
  const width = px((el<HTMLInputElement>("hWidth")).value || "1056") || 1056;
  const stage = el<HTMLIFrameElement>("stage"); stage.style.width = width + "px";
  const doc = stage.contentDocument!; doc.open(); doc.write(html); doc.close();
  await new Promise((r) => setTimeout(r, 350)); try { await (doc as any).fonts?.ready; } catch {}
  const body = doc.body;
  const tree: FigmaNode = { kind: "frame", name: "Imported page", x: 0, y: 0, w: width, h: Math.max(body.scrollHeight, 1), fill: parseColor(getComputedStyle(body).backgroundColor) || { r: 1, g: 1, b: 1, a: 1 }, children: [] };
  const out: FigmaNode[] = []; walk(body, doc, out); tree.children = out;
  el("hStatus").textContent = "Building…"; post({ type: "html-import", tree });
}
function absolutize(html: string, base: string) { try { const b = new URL(base); return html.replace(/(src|href)=["'](?!https?:|data:|#)([^"']+)["']/gi, (_m, a, p) => `${a}="${new URL(p, b).href}"`); } catch { return html; } }
function walk(node: Element, doc: Document, out: FigmaNode[]) {
  for (const child of Array.from(node.children)) {
    const s = getComputedStyle(child); const rect = child.getBoundingClientRect(); const win = doc.defaultView!;
    const x = rect.left + win.scrollX, y = rect.top + win.scrollY, w = rect.width, h = rect.height;
    if (!isRenderable({ display: s.display, visibility: s.visibility, opacity: s.opacity, width: w, height: h })) continue;
    const bg = parseColor(s.backgroundColor), border = parseColor(s.borderTopColor), bw = px(s.borderTopWidth), radius = parseRadius(s.borderTopLeftRadius);
    const tag = child.tagName.toLowerCase();
    if (hasVisibleBox(bg, bw > 0 ? border : null, radius)) out.push({ kind: "rect", name: tag, x, y, w, h, fill: bg, stroke: bw > 0 ? border : null, strokeWidth: bw, radius, opacity: parseFloat(s.opacity) });
    const txt = directText(child);
    if (txt) out.push({ kind: "text", name: txt.slice(0, 40), x, y, w, h, text: txt, fontSize: px(s.fontSize) || 16, fontFamily: (s.fontFamily.split(",")[0] || "Inter").replace(/["']/g, "").trim(), fontStyle: fontStyleName(s.fontWeight, s.fontStyle === "italic"), color: parseColor(s.color), align: textAlign(s.textAlign) });
    walk(child, doc, out);
  }
}
function directText(e: Element) { let s = ""; for (const n of Array.from(e.childNodes)) if (n.nodeType === 3) s += n.textContent || ""; return s.replace(/\s+/g, " ").trim(); }

// ── DEV ─────────────────────────────────────────────────────────────────────
let devBundle: any = null;
el("dGo").addEventListener("click", () => { el("dStatus").textContent = "Building…"; post({ type: "dev-export", prefix: (el<HTMLInputElement>("dPrefix")).value.trim() }); });
el("dCopy").addEventListener("click", () => copy((el<HTMLTextAreaElement>("dOut")).value, "dStatus"));
el("dDownload").addEventListener("click", () => {
  if (!devBundle) return;
  download("tokens.json", devBundle.tokensJson, "application/json");
  download("tokens.css", devBundle.tokensCss, "text/css");
  download("components.json", JSON.stringify(devBundle.components, null, 2), "application/json");
  el("dStatus").textContent = "Downloaded tokens.json + tokens.css + components.json ✓";
});

// ── inbound messages ─────────────────────────────────────────────────────────
onmessage = (e: MessageEvent) => {
  const m = e.data.pluginMessage; if (!m) return;
  switch (m.type) {
    case "error": setStatusAll(m.message); break;
    case "kit-done": el("kStatus").textContent = `Created ${m.components} components + styles ✓`; break;
    case "audit-result": renderAudit(m); break;
    case "library-result": renderLibrary(m); break;
    case "tokens-result": tJson = m.json; tCss = m.css; (el<HTMLTextAreaElement>("tOut")).value = tFmt === "json" ? tJson : tCss; el("tStatus").textContent = `${m.counts.colors} colors · ${m.counts.text} text ✓`; break;
    case "tokens-imported": el("tStatus").textContent = `Applied — ${m.created} created, ${m.updated} updated ✓`; break;
    case "filled": el("cStatus").textContent = `Filled ${m.n} layers ✓`; break;
    case "html-done": el("hStatus").textContent = `Imported ${m.count} layers ✓`; break;
    case "dev-bundle": devBundle = m; (el<HTMLTextAreaElement>("dOut")).value = `/* tokens.css */\n${m.tokensCss}\n\n/* ${m.components.length} components */\n${m.components.join("\n")}`; el("dStatus").textContent = "Bundle ready — Copy or Download ✓"; break;
  }
};

function renderAudit(m: any) {
  const f = m.findings as any[];
  if (!f.length) { el("aOut").innerHTML = `<div class="status" style="color:var(--ok)">✓ Clean across ${m.scanned} layers</div>`; return; }
  const order: any = { error: 0, warn: 1, info: 2 }; f.sort((a, b) => order[a.severity] - order[b.severity]);
  el("aOut").innerHTML = `<div class="summary"><div class="stat e"><b>${m.summary.errors}</b><span>Errors</span></div><div class="stat w"><b>${m.summary.warnings}</b><span>Warn</span></div><div class="stat i"><b>${m.summary.info}</b><span>Info</span></div></div><div class="list">${f.map((x) => `<div class="item" data-id="${x.id}"><span class="dot ${x.severity}"></span><div><div class="n">${esc(x.name)}</div><div class="m">${esc(x.message)}</div></div></div>`).join("")}</div>`;
  el("aOut").querySelectorAll<HTMLElement>(".item").forEach((r) => r.addEventListener("click", () => post({ type: "select", id: r.dataset.id })));
}
function renderLibrary(m: any) {
  const i = m.issues as any[]; const s = m.summary;
  const head = `<div class="summary"><div class="stat"><b>${s.score}</b><span>Health</span></div><div class="stat"><b>${s.components}</b><span>Comps</span></div><div class="stat e"><b>${s.errors + s.warnings}</b><span>Issues</span></div></div>`;
  if (!i.length) { el("lOut").innerHTML = head + `<div class="status" style="color:var(--ok)">✓ Library looks clean</div>`; return; }
  el("lOut").innerHTML = head + `<div class="list">${i.map((x) => `<div class="item" data-id="${x.id}"><span class="dot ${x.severity}"></span><div><div class="n">${esc(x.name)}</div><div class="m">${esc(x.message)}${x.suggestion ? " → " + esc(x.suggestion) : ""}</div></div></div>`).join("")}</div>`;
  el("lOut").querySelectorAll<HTMLElement>(".item").forEach((r) => r.addEventListener("click", () => post({ type: "select", id: r.dataset.id })));
}

function copy(txt: string, statusId: string) { navigator.clipboard.writeText(txt).then(() => el(statusId).textContent = "Copied ✓").catch(() => { }); }
function download(name: string, txt: string, type: string) { const b = new Blob([txt], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)); }
function rnd() { return Math.floor(Math.random() * 1e6); }
function setStatusAll(msg: string) { ["kStatus", "tStatus", "cStatus", "hStatus", "dStatus"].forEach((id) => { const e = document.getElementById(id); if (e) e.textContent = msg; }); }
