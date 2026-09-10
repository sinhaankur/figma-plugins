# sinhaankur Kit — all-in-one

One Figma plugin for the things you actually need. A home menu routes to every
tool; they share the same tested engines, so (for example) importing HTML can feed
component work. **On-device** — only the optional "HTML from URL" fetches a page.

## Tools
| Tool | What it does |
|---|---|
| 🧩 **Create UX kit** | Pick colors + a font → generates real components (buttons, inputs, cards, badges, avatar, toggle…) plus color styles and a type scale. |
| 🔍 **Audit** | WCAG contrast, hardcoded colors, off-scale spacing, tap targets — click to jump to the node. |
| 📚 **Library manager** | Scan components: naming, duplicates/near-duplicates, proposed structure, a health score. |
| 🎨 **Tokens sync** | Styles ⇄ W3C tokens JSON + CSS variables (export & re-apply). |
| ✍️ **Content filler** | Realistic on-device data (names, prices, dates, ratings…); auto-detects field type from layer names. |
| 🌐 **HTML → layers** | A live URL or pasted HTML → editable Figma layers from the computed CSS. |
| 💻 **Dev / VS Code** | Export a repo-ready bundle: `tokens.json` + `tokens.css` + a components manifest to drop into your codebase / a VS Code task. |

## Built on tested cores
The logic lives in `src/cores/` — the same unit-tested engines from the standalone
plugins (audit, tokens, data, css, library, kit). See each core's tests in the
sibling plugin folders (76 checks total across the repo).

## Install / launch
```bash
npm install
npm run build     # → dist/code.js + dist/ui.html
```
Figma desktop: **Plugins → Development → Import plugin from manifest…** →
`manifest.json`. To publish free to the Community, see [../LAUNCH.md](../LAUNCH.md).

MIT · by [Ankur Sinha](https://sinhaankur.com).
