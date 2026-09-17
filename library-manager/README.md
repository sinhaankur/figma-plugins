# Component Manager — by sinhaankur

Keep a Figma component library clean, and bootstrap a new one fast.

Two tools in one plugin:

## Audit library
Scans every component and component-set in the file and reports:
- **Unnamed / default names** (`Component 3`, `Frame 12`)
- **Not grouped** (no `Category/Name`)
- **Inconsistent casing** (suggests Title Case)
- **Exact + near-duplicate names** (edit-distance based)
- **Unused** components (0 instances, when usage is known)

You get a **health score (0–100)** and counts. Click any issue to select and zoom to
that component on the canvas. All logic is pure and unit-tested (`library-core.ts`).

## Generate kit
From a theme (accent / text / surface / muted colours, font family, corner radius)
it creates a **real starter UX kit**: buttons (primary/secondary/ghost), text field,
badge, chip, card, avatar, toggle, tag — plus **colour styles** and a **text style
scale** (Display → Caption). Everything is placed in a tidy section and selected.
Spec is pure and tested (`kit-core.ts`).

Runs fully on-device. No network.

## Build / install (development)
```bash
npm install
npm test          # 24/24 (library + kit cores)
npm run typecheck
npm run build     # → dist/code.js + dist/ui.html
```
Figma desktop: **Plugins → Development → Import plugin from manifest…** →
`manifest.json`.

## License
Free & open source (MIT). © Ankur Sinha.
