import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url"; import { dirname, join } from "path";
const root=dirname(fileURLToPath(import.meta.url)); const src=join(root,"src"); const dist=join(root,"dist");
if(!existsSync(dist)) mkdirSync(dist);
const watch=process.argv.includes("--watch");
async function build(){
  await esbuild.build({entryPoints:[join(src,"code.ts")],outfile:join(dist,"code.js"),bundle:true,target:"es2019",format:"iife",legalComments:"none"});
  const ui=await esbuild.build({entryPoints:[join(src,"ui.ts")],bundle:true,target:"es2020",format:"iife",write:false,legalComments:"none"});
  let html=readFileSync(join(src,"ui.html"),"utf8").replace('<script src="ui.js"></script>',`<script>${ui.outputFiles[0].text}</script>`);
  writeFileSync(join(dist,"ui.html"),html);
  console.log("built · dist/code.js + dist/ui.html (%d KB)",Math.round(html.length/1024));
}
await build();
if(watch){const{watch:w}=await import("fs");w(src,{recursive:true},()=>build().catch(e=>console.error(e)));console.log("watching…");}
