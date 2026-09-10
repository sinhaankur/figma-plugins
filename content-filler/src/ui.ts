// ui.ts — Content Filler UI: pick a mode (auto or a specific type), fill selected
// text; "Reshuffle" re-fills with a new seed for fresh values.
// © Ankur Sinha.

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let mode = "auto";
let seed = Math.floor(Math.random() * 1e6);

el("chips").querySelectorAll<HTMLElement>(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    el("chips").querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
    chip.classList.add("on");
    mode = chip.dataset.m!;
  }));

el("fill").addEventListener("click", () => {
  seed = Math.floor(Math.random() * 1e6);
  send();
});
el("reshuffle").addEventListener("click", () => { seed = Math.floor(Math.random() * 1e6); send(); });

function send() {
  el("status").textContent = "Filling…";
  parent.postMessage({ pluginMessage: { type: "fill", mode, seed } }, "*");
}

onmessage = (e: MessageEvent) => {
  const m = e.data.pluginMessage; if (!m) return;
  if (m.type === "count") {
    const n = m.n as number;
    el("count").innerHTML = n ? `<b>${n}</b> text layer${n === 1 ? "" : "s"} selected` : "Select text layers to fill…";
    (el<HTMLButtonElement>("fill")).disabled = n === 0;
  } else if (m.type === "filled") {
    el("status").textContent = `Filled ${m.n} layer${m.n === 1 ? "" : "s"} ✓ — Reshuffle for new values`;
  }
};
