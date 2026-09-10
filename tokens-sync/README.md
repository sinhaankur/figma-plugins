# Design Tokens Sync

Keep Figma and your codebase in sync. **Export** your Figma color, text and
spacing styles as **W3C design tokens (JSON)** or **CSS variables**; **import** a
tokens JSON back to create/update Figma color styles.

- **Export → Tokens JSON** — standard `{ "$value", "$type" }` format, nested by
  the `Group/Name` style naming.
- **Export → CSS variables** — `:root { --brand-accent: #F43F5E; ... }`, with an
  optional prefix (e.g. `--kelo-accent`) to match your site's CSS variables.
- **Import** — paste a tokens JSON and it creates/updates matching Figma color
  styles, so a change in code can flow back into the file.

All on-device.

## Tested core
`src/tokens-core.ts` is a pure conversion engine with a 19-check test suite
(`npm test`): hex round-trips, kebab/CSS-var naming, JSON⇄StyleSet round-trips.

## Install (development)
```bash
npm install
npm test          # 19/19
npm run build     # → dist/code.js + dist/ui.html
```
Figma: **Plugins → Development → Import plugin from manifest…** → `manifest.json`.

## Notes
- Figma has no native "spacing style"; spacing is harvested from FLOAT variables
  named like `spacing/*` (or `gap`/`size`) when present.
- Import currently applies **colors** to paint styles; text/spacing re-apply is a
  planned pass.

MIT.
