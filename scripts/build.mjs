import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist/vendor',{recursive:true});
await cp('public','dist',{recursive:true});
for(const [from,to] of [
  ['pdfjs-dist/legacy/build/pdf.mjs','pdf.mjs'],['pdfjs-dist/legacy/build/pdf.worker.mjs','pdf.worker.mjs'],
  ['jszip/dist/jszip.min.js','jszip.min.js'],['cfb/dist/cfb.js','cfb.js'],['pptxgenjs/dist/pptxgen.bundle.js','pptxgen.bundle.js']
])await cp(`node_modules/${from}`,`dist/vendor/${to}`);
for(const pkg of ['pdfjs-dist','jszip','cfb','pptxgenjs']){
  for(const name of ['LICENSE','LICENSE.md','LICENSE.txt']){
    try{await cp(`node_modules/${pkg}/${name}`,`dist/vendor/${pkg}-LICENSE.txt`);break;}catch{}
  }
}
// Existing planner styles stay intact. Hashes let Netlify enforce CSP without unsafe-inline scripts.
const html=await readFile('dist/index.html','utf8');
const hashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
await writeFile('dist/_headers',`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'\n/api/*\n  Cache-Control: no-store\n`);
console.log('Built dist: existing DDL planner + presentation assistant. No secrets embedded.');
