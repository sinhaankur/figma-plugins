// ui.ts — Component Manager UI controller. Two tabs: Audit (scan the file's
// components) and Generate kit (build components + styles from a theme). Talks to
// the sandbox (code.ts) via postMessage. © Ankur Sinha.

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = el("status");
const go = el<HTMLButtonElement>("go");
type Tab = "audit" | "kit";
let tab: Tab = "audit";

function setTab(t: Tab) {
  tab = t;
  el("tabAudit").classList.toggle("on", t === "audit");
  el("tabKit").classList.toggle("on", t === "kit");
  el("auditPane").classList.toggle("hidden", t !== "audit");
  el("kitPane").classList.toggle("hidden", t !== "kit");
  go.textContent = t === "audit" ? "Run audit" : "Generate kit";
  setStatus("");
}
el("tabAudit").addEventListener("click", () => setTab("audit"));
el("tabKit").addEventListener("click", () => setTab("kit"));

function setStatus(text: string, ok = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("ok", ok);
}

// keep color picker <-> hex text in sync
[["cAccent", "tAccent"], ["cFg", "tFg"], ["cBg", "tBg"], ["cMuted", "tMuted"]].forEach(([c, t]) => {
  const cc = el<HTMLInputElement>(c), tt = el<HTMLInputElement>(t);
  cc.addEventListener("input", () => (tt.value = cc.value.toUpperCase()));
  tt.addEventListener("input", () => { if (/^#[0-9a-fA-F]{6}$/.test(tt.value)) cc.value = tt.value; });
});

go.addEventListener("click", () => {
  if (tab === "audit") {
    setStatus("Scanning components…");
    parent.postMessage({ pluginMessage: { type: "audit" } }, "*");
  } else {
    const theme = {
      accent: el<HTMLInputElement>("tAccent").value.trim() || "#F43F5E",
      fg: el<HTMLInputElement>("tFg").value.trim() || "#0E0F13",
      bg: el<HTMLInputElement>("tBg").value.trim() || "#FFFFFF",
      muted: el<HTMLInputElement>("tMuted").value.trim() || "#9AA0AA",
      radius: parseInt(el<HTMLInputElement>("radius").value, 10) || 10,
      fontFamily: el<HTMLInputElement>("font").value.trim() || "Inter",
    };
    setStatus("Generating kit…");
    parent.postMessage({ pluginMessage: { type: "generate", theme } }, "*");
  }
});

function renderAudit(summary: any, issues: any[]) {
  const out = el("auditOut");
  const sev = (s: string) => issues.filter((i) => i.severity === s).length;
  const chips = `
    <div class="summary">
      <div class="chip score"><div class="n">${summary.score}</div><div class="l">health</div></div>
      <div class="chip"><div class="n">${summary.components}</div><div class="l">components</div></div>
      <div class="chip"><div class="n">${summary.variants}</div><div class="l">variants</div></div>
      <div class="chip"><div class="n">${sev("error")}</div><div class="l">errors</div></div>
      <div class="chip"><div class="n">${sev("warn")}</div><div class="l">warnings</div></div>
    </div>`;
  if (!issues.length) {
    out.innerHTML = chips + `<div class="empty">${summary.components ? "No issues — clean library ✓" : "No components in this file yet."}</div>`;
    return;
  }
  const rows = issues.map((i) => `
    <div class="issue" data-id="${i.id}">
      <div class="top"><span class="dot ${i.severity}"></span><span class="name">${esc(i.name || "(unnamed)")}</span></div>
      <div class="msg">${esc(i.message)}</div>
      ${i.suggestion ? `<div class="sug">→ ${esc(i.suggestion)}</div>` : ""}
    </div>`).join("");
  out.innerHTML = chips + `<div class="issues">${rows}</div>`;
  out.querySelectorAll<HTMLElement>(".issue").forEach((row) =>
    row.addEventListener("click", () => parent.postMessage({ pluginMessage: { type: "select", id: row.dataset.id } }, "*")));
}

function esc(s: string) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)); }

onmessage = (e: MessageEvent) => {
  const m = e.data.pluginMessage; if (!m) return;
  if (m.type === "audit-result") {
    renderAudit(m.summary, m.issues);
    setStatus(m.issues.length ? `${m.issues.length} issue${m.issues.length > 1 ? "s" : ""} found` : "Clean ✓", !m.issues.length);
  }
  if (m.type === "gen-progress") setStatus(`Building… ${m.done}/${m.total}`);
  if (m.type === "gen-done") setStatus(`Created ${m.components} components · ${m.colors} colour + ${m.textStyles} text styles ✓`, true);
  if (m.type === "error") setStatus(m.message);
};
