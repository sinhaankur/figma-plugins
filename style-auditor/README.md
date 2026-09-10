# Style & A11y Auditor

Scan a Figma page (or selection) and get a clickable report of design-system and
accessibility problems. Click any finding to jump straight to the node.

**Checks:**
- **Contrast (WCAG 2.1)** — text vs its resolved background; flags anything below
  AA (and notes AA-but-not-AAA). Size/weight aware (large text = ≥24px or ≥18.66px bold).
- **Hardcoded colors** — fills not bound to a color style/variable.
- **Detached instances** — components that got detached.
- **Off-scale spacing** — auto-layout padding/gap off the 4/8 spacing scale.
- **Small tap targets** — interactive elements below 44px.

Everything runs **on-device**; nothing leaves Figma.

## Tested core
The audit logic is a pure, framework-agnostic module (`src/audit-core.ts`) with a
test suite (`npm test`, 17 checks) — including the WCAG contrast math verified
against known values (black-on-white = 21:1, etc.). The Figma side just adapts
real nodes into the tested core.

## Install (development)
```bash
npm install
npm test          # 17/17 — proves the audit math
npm run build     # → dist/code.js + dist/ui.html
```
In Figma: **Plugins → Development → Import plugin from manifest…** → `manifest.json`.

## Notes
- Background resolution for contrast walks up to the first ancestor with a solid
  fill (good heuristic; exact stacking would need a render pass).
- Detached-instance detection is heuristic (frame named like a `Category/Name`
  component with no link) — Figma exposes no "was detached" flag.

MIT.
