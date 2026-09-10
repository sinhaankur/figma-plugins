# Launching a plugin on the Figma Community (free)

You can't upload plugin files to a website — Figma **publishes from the desktop
app**. Here's the exact flow for any plugin in this repo.

## 1. Build it
```bash
cd <plugin>          # e.g. html-to-figma
npm install
npm run build        # → dist/code.js + dist/ui.html
```

## 2. Load it locally (test first)
1. Open **Figma desktop** (publishing needs the desktop app, not the browser).
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Select the plugin's `manifest.json`.
4. Run it: **Plugins → Development → <plugin name>**. Confirm it works.

## 3. Publish to the Community
1. Menu → **Plugins → Development → <plugin name> → Publish…**
   (or Plugins → Manage plugins → the plugin → **Publish**).
2. Fill the listing:
   - **Name** — e.g. "HTML to Figma — by sinhaankur"
   - **Icon** — upload `assets/icon-128.png` (128×128)
   - **Cover art** — upload `assets/cover.png` (1920×960)
   - **Description**, **tags**, **support contact** (he66al@gmail.com or the repo)
3. Choose **who can run it** → *Everyone* (public/free).
4. Submit. Figma **reviews** it (usually a day or two); you get an email when live.

## Notes
- **Free** is the default — there's no fee to publish, and you set price = free.
- **Open source:** link this repo (github.com/sinhaankur/figma-plugins) in the
  listing's description; the code stays MIT.
- **Updates:** bump the version, `npm run build`, then Publish again → "Update".
- **networkAccess:** listings that fetch (like HTML-from-URL) must declare it in
  `manifest.json` — already set. Reviewers read the `reasoning` string.

## First to launch
`html-to-figma` is the most demo-friendly. Then style-auditor, tokens-sync,
content-filler, pdf-to-figma.
