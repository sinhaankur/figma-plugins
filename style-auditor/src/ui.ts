// ui.ts — the auditor report UI. Sends the run request with options, renders the
// findings grouped by severity, and jumps to a node when a finding is clicked.
//
// © Ankur Sinha.

interface Finding { id: string; name: string; severity: "error" | "warn" | "info"; rule: string; message: string; }
interface Summary { total: number; errors: number; warnings: number; info: number; byRule: Record<string, number>; }

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = el("out");
let scope: "page" | "selection" = "page";

el("scopePage").addEventListener("click", () => setScope("page"));
el("scopeSel").addEventListener("click", () => setScope("selection"));
function setScope(s: "page" | "selection") {
  scope = s;
  el("scopePage").classList.toggle("on", s === "page");
  el("scopeSel").classList.toggle("on", s === "selection");
}

el("run").addEventListener("click", () => {
  out.innerHTML = `<div class="empty">Scanning…</div>`;
  parent.postMessage({ pluginMessage: { type: "run", scope, opts: {
    checkContrast: (el<HTMLInputElement>("cContrast")).checked,
    checkHardcoded: (el<HTMLInputElement>("cHardcoded")).checked,
    checkDetached: (el<HTMLInputElement>("cDetached")).checked,
    checkSpacing: (el<HTMLInputElement>("cSpacing")).checked,
    checkTapTargets: (el<HTMLInputElement>("cTap")).checked,
  } } }, "*");
});

onmessage = (e: MessageEvent) => {
  const msg = e.data.pluginMessage;
  if (!msg || msg.type !== "result") return;
  render(msg.findings as Finding[], msg.summary as Summary, msg.scanned as number);
};

function render(findings: Finding[], summary: Summary, scanned: number) {
  if (!findings.length) {
    out.innerHTML = `<div class="clean">✓ Clean — no issues across ${scanned} layers.</div>`;
    return;
  }
  const order = { error: 0, warn: 1, info: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  const rows = findings.map((f) =>
    `<div class="item" data-id="${f.id}">
      <span class="dot ${f.severity}"></span>
      <div><div class="n">${escape(f.name)}</div><div class="m">${escape(f.message)}</div></div>
    </div>`).join("");
  out.innerHTML = `
    <div class="summary">
      <div class="stat e"><b>${summary.errors}</b><span>Errors</span></div>
      <div class="stat w"><b>${summary.warnings}</b><span>Warnings</span></div>
      <div class="stat i"><b>${summary.info}</b><span>Info</span></div>
    </div>
    <div class="sub">${summary.total} issues across ${scanned} layers</div>
    <div class="list">${rows}</div>`;
  out.querySelectorAll<HTMLElement>(".item").forEach((row) =>
    row.addEventListener("click", () =>
      parent.postMessage({ pluginMessage: { type: "select", id: row.dataset.id } }, "*")));
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
