// ui.ts — Tokens Sync UI: export (JSON/CSS with copy+download) and import (paste
// tokens JSON → apply to Figma color styles).
// © Ankur Sinha.

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let fmt: "json" | "css" = "json";
let lastJson = "", lastCss = "";

el("tabExport").addEventListener("click", () => tab("export"));
el("tabImport").addEventListener("click", () => tab("import"));
function tab(t: "export" | "import") {
  el("tabExport").classList.toggle("on", t === "export");
  el("tabImport").classList.toggle("on", t === "import");
  el("paneExport").classList.toggle("hidden", t !== "export");
  el("paneImport").classList.toggle("hidden", t !== "import");
}

el("fmtJson").addEventListener("click", () => setFmt("json"));
el("fmtCss").addEventListener("click", () => setFmt("css"));
function setFmt(f: "json" | "css") {
  fmt = f;
  el("fmtJson").classList.toggle("on", f === "json");
  el("fmtCss").classList.toggle("on", f === "css");
  (el<HTMLTextAreaElement>("outText")).value = f === "json" ? lastJson : lastCss;
}

el("doExport").addEventListener("click", () => {
  el("status").textContent = "Reading styles…";
  parent.postMessage({ pluginMessage: { type: "export", prefix: (el<HTMLInputElement>("prefix")).value.trim() } }, "*");
});

el("copy").addEventListener("click", async () => {
  const txt = (el<HTMLTextAreaElement>("outText")).value;
  try { await navigator.clipboard.writeText(txt); el("status").textContent = "Copied ✓"; }
  catch { (el<HTMLTextAreaElement>("outText")).select(); document.execCommand("copy"); el("status").textContent = "Copied ✓"; }
});

el("download").addEventListener("click", () => {
  const txt = (el<HTMLTextAreaElement>("outText")).value;
  const blob = new Blob([txt], { type: fmt === "json" ? "application/json" : "text/css" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fmt === "json" ? "tokens.json" : "tokens.css";
  a.click(); URL.revokeObjectURL(a.href);
});

el("doImport").addEventListener("click", () => {
  const json = (el<HTMLTextAreaElement>("inText")).value.trim();
  if (!json) { el("status").textContent = "Paste a tokens JSON first."; return; }
  el("status").textContent = "Applying…";
  parent.postMessage({ pluginMessage: { type: "import", json } }, "*");
});

onmessage = (e: MessageEvent) => {
  const m = e.data.pluginMessage; if (!m) return;
  if (m.type === "exported") {
    lastJson = m.json; lastCss = m.css;
    (el<HTMLTextAreaElement>("outText")).value = fmt === "json" ? lastJson : lastCss;
    el("counts").textContent = `${m.counts.colors} colors · ${m.counts.text} text · ${m.counts.spacing} spacing`;
    el("status").textContent = "Exported ✓";
  } else if (m.type === "imported") {
    el("status").textContent = `Applied — ${m.created} created, ${m.updated} updated ✓`;
  } else if (m.type === "import-error") {
    el("status").textContent = m.message;
  }
};
