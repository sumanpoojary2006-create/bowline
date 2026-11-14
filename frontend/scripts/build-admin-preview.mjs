import { build } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'admin-preview.html');
const result = await build({
  stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {Toaster} from 'react-hot-toast'; import App from './src/App'; import {AuthProvider} from './src/context/AuthContext'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/admin/overview']}><AuthProvider><App/><Toaster/></AuthProvider></MemoryRouter>);`,resolveDir:root,loader:'jsx'},
  bundle:true,write:false,format:'esm',jsx:'automatic',minify:true,
  define:{'import.meta.env':JSON.stringify({DEV:true,VITE_ADMIN_PREVIEW:'true'}),'process.env.NODE_ENV':'"production"'},
  loader:{'.jpg':'dataurl','.png':'dataurl','.css':'empty'},
});
const files = await readdir(resolve(root,'dist/assets'));
let css = await readFile(resolve(root,'dist/assets',files.find(f => /^index-.*\.css$/.test(f))),'utf8');
for(const f of files.filter(f => f.endsWith('.css') && !f.startsWith('index-'))) css += '\n'+await readFile(resolve(root,'dist/assets',f),'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Bowline hosting · Design preview</title><style>${css}</style></head><body><div id="root"></div><script type="module">${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
// A resizable iframe supplies an independent viewport for each device layout.
// Switching devices preserves the current page and sample edits.
const previewDocument = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Bowline · Admin preview</title><style>
*{box-sizing:border-box}body{margin:0;background:#eeede9;color:#222;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}header{height:64px;display:flex;align-items:center;justify-content:center;gap:16px;padding:10px 16px;background:white;border-bottom:1px solid #ddd}header strong{font-size:14px}header label{font-size:12px;display:flex;gap:8px;align-items:center}select{font:inherit;border:1px solid #ddd;border-radius:8px;padding:8px;background:white}main{display:flex;justify-content:center;padding:20px 0;height:calc(100dvh - 64px)}iframe{width:1280px;max-width:100%;height:100%;border:1px solid #ddd;border-radius:24px;background:white;box-shadow:0 8px 40px #0001}@media(max-width:600px){header{height:56px;gap:10px}header strong{font-size:12px}main{padding:0;height:calc(100dvh - 56px)}iframe{border:0;border-radius:0;width:100%!important;box-shadow:none}}
</style></head><body><header><strong>Bowline · Admin preview</strong><label>Device<select id="viewport" aria-label="Preview screen width"><option value="360">Small phone · 360</option><option value="390">Phone · 390</option><option value="430">Large phone · 430</option><option value="768">Tablet · 768</option><option value="1280" selected>Desktop · 1280</option></select></label></header><main><iframe id="preview" title="Bowline hosting admin preview"></iframe></main><script>const frame=document.getElementById('preview');const picker=document.getElementById('viewport');picker.value=window.matchMedia('(max-width:600px)').matches?'390':'1280';frame.style.width=picker.value+'px';frame.srcdoc=${JSON.stringify(html).replaceAll('<', '\\u003c')};document.getElementById('viewport').addEventListener('change',event=>{frame.style.width=event.target.value+'px'});</script></body></html>`;
await writeFile(output,previewDocument); console.log(`Preview created: ${output}`);
