# Content Filler — realistic data

Kill lorem ipsum. Select text layers and fill them with realistic, varied data —
**on-device, no network**.

- **Auto mode** reads each layer's name (`Email`, `Price`, `Full name`, `Bio`, …)
  and fills the right kind of data. Falls back to the existing text length when the
  name isn't a hint.
- Or force one type: name, email, price, date, city, company, job title, rating,
  phone, sentence, paragraph.
- Each layer gets a different seed → a list/table looks real, not repeated.
- **Reshuffle** re-fills with fresh values.

## Tested core
`src/data-core.ts` — seeded (reproducible) generators + a field-type detector,
with an 18-check suite (`npm test`): format checks (email/price/date/rating), same
seed → same value, and name → type detection.

## Install (development)
```bash
npm install
npm test          # 18/18
npm run build     # → dist/code.js + dist/ui.html
```
Figma: **Plugins → Development → Import plugin from manifest…** → `manifest.json`.
Select text layers, pick a mode, **Fill**.

MIT.
