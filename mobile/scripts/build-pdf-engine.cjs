const esbuild = require('esbuild');
const fs = require('node:fs');
async function main() {
  const bundle = async (entry, name) => (await esbuild.build({entryPoints:[require.resolve(entry)],bundle:true,write:false,format:'iife',globalName:name,target:'safari16',minify:true})).outputFiles[0].text;
  const worker = await bundle('pdfjs-dist/legacy/build/pdf.worker.mjs','pdfjsWorker');
  const reader = await bundle('pdfjs-dist/legacy/build/pdf.mjs','pdfjsLib');
  fs.writeFileSync('src/generated/pdf-engine.json', JSON.stringify({script:worker+'\n'+reader}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
