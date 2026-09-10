# PDF to Figma — import & edit

Figma can't import PDFs. This plugin does — and keeps the text **editable**.

Drop a PDF and get **one frame per page**:
- the page **rendered as an exact image** (so it looks right), and
- **real, editable Figma text nodes** laid on top, extracted from the PDF's text
  layer (positions, sizes, bold/italic).

Turn the image off for a **text-only, vector-first** import. Everything runs
**on-device** — the PDF is parsed inside the plugin with a bundled copy of
[pdf.js](https://github.com/mozilla/pdf.js); nothing ever leaves Figma.

## Install (development)
```bash
npm install
npm run build     # → dist/code.js + dist/ui.html
```
In Figma desktop: **Plugins → Development → Import plugin from manifest…** → select
`manifest.json`. Run it, drop a PDF, click **Import to Figma**.

## How it works
- `src/ui.ts` (iframe) — loads the PDF with pdf.js, renders each page to a 2× PNG,
  and extracts text runs with their transform → position/size/style.
- `src/code.ts` (sandbox) — builds the Figma nodes: a frame per page, the render as
  a locked image layer, and editable text on top, all named and grouped.
- `build.mjs` — esbuild bundles everything into a single self-contained `ui.html`
  (Figma UIs can't fetch over the network) with the pdf.js worker inlined as a blob.

## Notes & limits
- Up to ~50 pages per import (tunable in `ui.ts`).
- Outlined/vectorised fonts have no text layer → they come through in the image only.
- Text colour defaults to black (extracting per-glyph fill needs the PDF op-list —
  a planned enhancement).
- Fonts map to Inter (Regular/Bold/Italic); exact font matching is a later pass.

MIT · PDF parsing by pdf.js (Apache-2.0).
