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
  // 1) Minify the bookmarklet into a `javascript:` URL. It's an IIFE already, so we
  //    just minify + URL-encode it. Written to dist/bookmarklet.txt (draggable URL)
  //    and injected into the UI as __BOOKMARKLET__ so the plugin can offer it.
  const bmSrc = readFileSync(join(src, "bookmarklet.js"), "utf8");
  const bmMin = (await esbuild.transform(bmSrc, { minify: true, target: "es2019" })).code.trim();
  const bookmarklet = "javascript:" + encodeURIComponent(bmMin);
  writeFileSync(join(dist, "bookmarklet.txt"), bookmarklet);
  writeFileSync(join(dist, "bookmarklet.min.js"), bmMin);

  // 2) Sandbox code.
  await esbuild.build({
    entryPoints: [join(src, "code.ts")], outfile: join(dist, "code.js"),
    bundle: true, target: "es2019", format: "iife", legalComments: "none",
  });

  // 3) UI — inline the bookmarklet string via define.
  const ui = await esbuild.build({
    entryPoints: [join(src, "ui.ts")], bundle: true, target: "es2020",
    format: "iife", write: false, legalComments: "none",
    define: { __BOOKMARKLET__: JSON.stringify(bookmarklet) },
  });
  const html = readFileSync(join(src, "ui.html"), "utf8")
    .replace('<script src="ui.js"></script>', `<script>${ui.outputFiles[0].text}</script>`);
  writeFileSync(join(dist, "ui.html"), html);

  console.log("built · dist/code.js + dist/ui.html (%d KB) + dist/bookmarklet.txt (%d B)",
    Math.round(html.length / 1024), bookmarklet.length);
}

await build();
if (watch) {
  const { watch: w } = await import("fs");
  w(src, { recursive: true }, () => build().catch((e) => console.error(e)));
  console.log("watching…");
}
