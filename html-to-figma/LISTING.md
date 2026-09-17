# Figma Community listing — HTML to Figma (by sinhaankur)

Copy-paste fields for **Figma → Plugins → Development → Publish**.

---

**Name:** HTML to Figma

**Tagline (≤ a line):**
Turn any live web page — including JavaScript-rendered pages and AI design bundles — into editable Figma layers.

**Description:**
HTML to Figma converts a real web page into **editable Figma layers** — not a
screenshot. Text becomes text (font, size, weight, colour, alignment, line-height),
boxes become rectangles (fill, border, corner radius, opacity, drop shadow), and
images come in embedded as fills.

Most "URL to Figma" tools break on modern sites because a Figma plugin can't run a
page's JavaScript — so React/Vue apps, SPAs and AI-generated design bundles show up
blank. This plugin solves that with **Receive mode**: a tiny "Send to Figma"
bookmarklet captures the page **in your own browser, after it fully renders**, then
you paste it into the plugin. Everything comes across faithfully.

**Three ways to import**
- **Receive** (recommended) — capture any fully-rendered page via the bookmarklet, paste, import. Handles JS-rendered pages, SPAs and AI design bundles.
- **Paste HTML** — paste a static page's source; it's rendered and converted.
- **From URL** — fetch a static, CORS-open URL directly.

**Options**
- Group everything into one frame, or drop the layers loose on the canvas.
- Missing fonts fall back to Inter and are reported after import.

Runs on your device. Free and open source (MIT).

**How to use (put in the listing's instructions):**
1. Run the plugin → **Receive** → open **How to get the bookmarklet** → drag
   **"↝ Send to Figma"** to your browser's bookmarks bar (one time).
2. Open the page you want and let it fully render.
3. Click **Send to Figma** — it copies the layout.
4. Back in Figma → paste (⌘V) → **Import to Figma**.

**Tags:** html, import, web, url, code to design, developer, css, convert, prototype, screenshot alternative

**Support / author:** sinhaankur · https://github.com/sinhaankur/figma-plugins

---

## Assets checklist (Figma requires)
- [x] Plugin icon 128×128 → `assets/icon-128.png`
- [x] Cover art 1920×960 (3:2 shown at various sizes) → `assets/cover.png` (verify it's ≥1920×960 before publishing)
- [ ] 1–3 screenshots of a real import (recommended) — capture after running it once.

## Pre-publish steps
1. `npm test` (24/24) and `npm run build`.
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…** → `manifest.json`; smoke-test Receive + Paste HTML.
3. **Plugins → Development → Publish…** — choose **Publish new**, fill the fields
   above, upload icon + cover, set **Creator = your Figma account (sinhaankur)**.
4. Submit for review. First-time review is typically 5–10 business days.

Note: publishing is done in the Figma desktop app under your own account — it can't
be done from the CLI. Everything the review needs (manifest, built files, listing
copy, assets) is ready in this folder.
