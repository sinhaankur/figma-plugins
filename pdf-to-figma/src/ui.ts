// ui.ts — the plugin UI (iframe with DOM). Uses the bundled pdf.js to parse the
// PDF: render each page to a PNG, and extract text runs with their position, size,
// font style and colour. Sends structured pages to the sandbox (code.ts).
//
// © Ankur Sinha. PDF parsing: pdf.js (Mozilla, Apache-2.0), bundled.

import * as pdfjsLib from "pdfjs-dist/build/pdf.min.mjs";
// The worker source is injected at build time as a blob URL on window.
declare global { interface Window { __PDF_WORKER__?: string } }

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const drop = el<HTMLLabelElement>("drop");
const fileInput = el<HTMLInputElement>("file");
const fileInfo = el("fileInfo");
const fname = el("fname"), fmeta = el("fmeta");
const go = el<HTMLButtonElement>("go");
const bar = el("bar"), fill = el<HTMLElement>("fill"), status = el("status");
const optImage = el<HTMLInputElement>("optImage");
const optText = el<HTMLInputElement>("optText");

let currentFile: File | null = null;
const RENDER_SCALE = 2;     // 2× for crisp page images
const MAX_PAGES = 50;

// ── file selection ────────────────────────────────────────────────────────────
["dragover", "dragenter"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("hover"); }));
["dragleave", "drop"].forEach((e) => drop.addEventListener(e, () => drop.classList.remove("hover")));
drop.addEventListener("drop", (ev) => { ev.preventDefault(); const f = ev.dataTransfer?.files?.[0]; if (f) setFile(f); });
fileInput.addEventListener("change", () => { const f = fileInput.files?.[0]; if (f) setFile(f); });
el("clear").addEventListener("click", (ev) => { ev.preventDefault(); currentFile = null; fileInfo.classList.remove("show"); go.disabled = true; });
el("cancel").addEventListener("click", () => parent.postMessage({ pluginMessage: { type: "cancel" } }, "*"));

function setFile(f: File) {
  if (!/pdf$/i.test(f.name) && f.type !== "application/pdf") { status.textContent = "That's not a PDF."; return; }
  currentFile = f;
  fname.textContent = f.name;
  fmeta.textContent = `${(f.size / 1024 / 1024).toFixed(1)} MB`;
  fileInfo.classList.add("show");
  go.disabled = false;
  status.textContent = "";
}

// ── import ─────────────────────────────────────────────────────────────────────
go.addEventListener("click", async () => {
  if (!currentFile) return;
  go.disabled = true; bar.classList.add("show"); setProgress(0);
  try {
    const buf = new Uint8Array(await currentFile.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const n = Math.min(pdf.numPages, MAX_PAGES);
    const pages = [];
    for (let i = 1; i <= n; i++) {
      status.textContent = `Rendering page ${i} of ${n}…`;
      pages.push(await renderPage(pdf, i));
      setProgress(i / n * 0.9);
    }
    status.textContent = "Building Figma layers…";
    setProgress(0.95);
    parent.postMessage({ pluginMessage: {
      type: "import", pages, fileName: currentFile.name,
      placeImage: optImage.checked, placeText: optText.checked,
    } }, "*");
  } catch (e: any) {
    status.textContent = "Couldn't read that PDF: " + (e?.message || e);
    go.disabled = false; bar.classList.remove("show");
  }
});

async function renderPage(pdf: any, pageNum: number) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const widthPt = viewport.width, heightPt = viewport.height;

  // render to canvas at 2× → PNG
  const rv = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rv.width); canvas.height = Math.ceil(rv.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: rv }).promise;
  const imagePng = optImage.checked ? await canvasToPng(canvas) : new Uint8Array();

  // extract text runs
  const texts = optText.checked ? await extractText(page, heightPt) : [];
  return { index: pageNum - 1, widthPt, heightPt, imagePng, texts };
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// Turn pdf.js text items into positioned runs. pdf.js gives a transform matrix
// [a,b,c,d,e,f]; e,f are x,y in a y-UP space → flip to Figma's y-down.
async function extractText(page: any, heightPt: number) {
  const content = await page.getTextContent();
  const styles = content.styles || {};
  const runs = [];
  for (const item of content.items) {
    const str = (item.str || "").replace(/\s+$/,"");
    if (!str) continue;
    const [a, b, , d, e, f] = item.transform;
    const fontSize = Math.hypot(b, d) || Math.abs(d) || 10;
    const w = item.width || str.length * fontSize * 0.5;
    const h = item.height || fontSize;
    // y in pdf is baseline from bottom → convert to top-left, y-down
    const x = e;
    const y = heightPt - f - fontSize * 0.8;
    const st = styles[item.fontName] || {};
    const fam = (st.fontFamily || "").toLowerCase();
    const bold = /bold|black|semibold|heavy/.test(fam) || /bold/.test((item.fontName||"").toLowerCase());
    const italic = /italic|oblique/.test(fam) || /italic|oblique/.test((item.fontName||"").toLowerCase());
    runs.push({
      text: str, x, y, w, h, fontSize,
      fontName: item.fontName || "",
      color: [0, 0, 0] as [number, number, number], // pdf.js text colour needs the op-list; default black (readable, editable)
      bold, italic,
    });
  }
  return runs;
}

function setProgress(p: number) { fill.style.width = Math.round(p * 100) + "%"; }

// pdf.js worker: a blob URL injected at build time. Set before any getDocument().
try { (pdfjsLib as any).GlobalWorkerOptions.workerSrc = window.__PDF_WORKER__ || ""; } catch {}
