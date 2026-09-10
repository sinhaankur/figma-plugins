// build.mjs — bundle the Figma plugin into a self-contained plugin (Figma UIs
// must be a single HTML file with no network). esbuild bundles ui.ts together
// with pdf.js; the pdf.js worker is inlined as a blob URL on window.
//
// © Ankur Sinha.

import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");
if (!existsSync(dist)) mkdirSync(dist);
const watch = process.argv.includes("--watch");

async function build() {
  // 1. sandbox code (Figma API side)
  await esbuild.build({
    entryPoints: [join(src, "code.ts")],
    outfile: join(dist, "code.js"),
    bundle: true, target: "es2019", format: "iife", legalComments: "none",
  });

  // 2. the pdf.js worker → a self-contained blob URL, prepended to the UI bundle
  const worker = readFileSync(join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"), "utf8");
  const workerBanner =
    "window.__PDF_WORKER__=URL.createObjectURL(new Blob([" +
    JSON.stringify(worker) +
    "],{type:'text/javascript'}));";

  // 3. UI logic bundled WITH pdf.js (esbuild resolves the ESM import)
  const ui = await esbuild.build({
    entryPoints: [join(src, "ui.ts")],
    bundle: true, target: "es2020", format: "iife", write: false,
    legalComments: "none", banner: { js: workerBanner },
  });
  const uiJs = ui.outputFiles[0].text;

  // 4. assemble the single ui.html
  let html = readFileSync(join(src, "ui.html"), "utf8");
  html = html
    .replace('<script src="pdfjs.js"></script>', "")
    .replace('<script src="ui.js"></script>', `<script>${uiJs}</script>`);
  writeFileSync(join(dist, "ui.html"), html);

  const kb = Math.round(html.length / 1024);
  console.log(`built · dist/code.js + dist/ui.html (${kb} KB, pdf.js inlined)`);
}

await build();
if (watch) {
  const { watch: fsWatch } = await import("fs");
  fsWatch(src, { recursive: true }, () => build().catch((e) => console.error(e)));
  console.log("watching src/…");
}
