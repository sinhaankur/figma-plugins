# HTML → Figma — by sinhaankur

Turn a **live web page** — including JavaScript-rendered pages, SPAs, and Claude
design bundles — into **editable Figma layers** (real frames, text, fills and
images read from the page's computed CSS). Not a screenshot.

![cover](./assets/cover.png)

## Why "Receive" (the reliable mode)

Figma's plugin sandbox **can't run an arbitrary page's JavaScript**, so any page
that renders itself with JS (Claude bundles, React/Vue SPAs, most modern sites)
shows up blank or as an "unpacking…" shell if you try to fetch it from inside
Figma. The fix: capture the page **in your own browser**, where it fully renders,
then hand the result to the plugin.

### One-time setup
1. Open the plugin in Figma → **Receive** tab → expand **How to get the bookmarklet**.
2. **Drag the "↝ Send to Figma" button to your browser's bookmarks bar.**
   (Or click *copy bookmarklet*, make a new bookmark, and paste it as the URL.)

### Each import
1. Open your page in the browser and let it **fully render**.
2. Click the **Send to Figma** bookmarklet — it walks the live DOM, captures text,
   boxes and images, and **copies** the layout to your clipboard.
3. In Figma → plugin → **Receive** → paste (⌘V) → **Import to Figma**.

You get a page frame with every element as a positioned, editable layer: text
nodes (font/size/weight/color/align/line-height), rectangles (fill/border/radius/
opacity/shadow) and **images embedded as fills**.

## Other modes
- **Paste HTML** — paste a static page's HTML; rendered in a hidden iframe and
  walked. Good for simple, self-contained markup.
- **From URL** — fetches a URL's HTML (subject to CORS) and renders it. Only works
  for simple static pages that allow cross-origin fetch; JS-rendered pages won't
  render here — use **Receive**.

## Tested core
`src/css-core.ts` maps CSS computed values → Figma values (color incl. modern
`rgb()`/alpha, font-weight → style, radius, align, box-shadow, renderability).
Suite: `npm test` (24 checks). End-to-end verified against a live Claude design
bundle: 1567 layers captured (text + rects + embedded images), 0 errors.

## Build / install (development)
```bash
npm install
npm test          # 24/24
npm run build     # → dist/code.js + dist/ui.html + dist/bookmarklet.txt
```
Figma desktop: **Plugins → Development → Import plugin from manifest…** →
`manifest.json`.

## Limits
- CSS gradients and `<canvas>`/WebGL become a solid box or drop (they're not DOM
  boxes with a computed color). Cross-origin images that block canvas capture are
  skipped (placed as a light box).
- Auto-layout isn't inferred — layers are absolutely positioned from their on-page
  box (pixel-accurate, but not responsive).

## Launch
Free & open source (MIT). © Ankur Sinha. See [LAUNCH.md](../LAUNCH.md).
