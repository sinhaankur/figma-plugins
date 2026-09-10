# Figma plugins

On-device Figma plugins by [Ankur Sinha](https://sinhaankur.com). Privacy-first —
they run entirely inside Figma, no network, nothing leaves your machine.

## Plugins

| Plugin | What it does | Status |
|---|---|---|
| [PDF to Figma](./pdf-to-figma) | Import a PDF as editable frames (exact page image + editable text via bundled pdf.js) | ✅ built |
| [Style & A11y Auditor](./style-auditor) | Flag hardcoded colors, detached instances, off-scale spacing, low contrast (WCAG), small tap targets — click to jump to the node | ✅ built (17 tests) |
| [Design Tokens Sync](./tokens-sync) | Figma styles ⇄ W3C design tokens JSON + CSS variables; export and re-apply | ✅ built (19 tests) |
| [Content Filler](./content-filler) | Replace lorem ipsum with realistic on-device data — auto-detects field type from layer names | ✅ built (18 tests) |
| [HTML → Figma](./html-to-figma) | A live URL or pasted HTML → real editable Figma layers (computed CSS → frames/text/fills) | ✅ built (22 tests) |
| Component Library Manager | Scan for reusable pieces, promote to components, tidy naming, keep the system coherent | ⏳ planned |
| Figma → clean code | Export a frame as production HTML/CSS or React + Tailwind | ⏳ planned |

**Launching:** see [LAUNCH.md](./LAUNCH.md) — free, open-source, published to the Figma Community from the desktop app.
| Real content filler | Replace lorem ipsum with realistic on-device data (names, prices, dates) | ⏳ planned |

## Build any plugin
```bash
cd <plugin>
npm install
npm run build       # → dist/code.js + dist/ui.html
npm test            # where a plugin has a tested core (e.g. style-auditor)
```
Then in Figma: **Plugins → Development → Import plugin from manifest…** → pick that
plugin's `manifest.json`.

## Why on-device
Every plugin declares `networkAccess: none`. Your files, PDFs, and content never
leave Figma — the design equivalent of the rest of the [sinhaankur.com](https://sinhaankur.com)
tools (Kelo, the Universe Engine): private by default.

## License
MIT (code). PDF parsing by [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), bundled.
