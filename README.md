# Figma plugins

On-device Figma plugins by [Ankur Sinha](https://sinhaankur.com). Privacy-first —
they run entirely inside Figma, no network, nothing leaves your machine.

## Plugins

### 1. [PDF to Figma](./pdf-to-figma) — import & edit
Figma can't import PDFs. This does: drop a PDF and get **one editable frame per
page** — the page rendered as an exact image, with **real editable text nodes**
laid on top (extracted via a bundled pdf.js). Toggle image/text; text-only gives a
vector-first import. All on-device.

### 2. Component Library Manager — *(in progress)*
Build, organise and audit a component library: scan a file for reusable pieces,
promote them to components, tidy naming, and keep the system coherent.

## Build a plugin
```bash
cd pdf-to-figma
npm install
npm run build       # → dist/code.js + dist/ui.html
```
Then in Figma: **Plugins → Development → Import plugin from manifest…** → pick
`pdf-to-figma/manifest.json`.

## License
MIT (code). PDF parsing by [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), bundled.
