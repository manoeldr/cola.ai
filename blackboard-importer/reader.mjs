import {extractPages} from './text-extraction.mjs';
const status = document.getElementById('status');
const fileInput = document.getElementById('file');
const save = document.getElementById('save'), txt = document.getElementById('txt');
let material;
const params = new URLSearchParams(location.hash.slice(1));
const metadata = {name:params.get('name') || 'material.pdf', course:params.get('course') || null, courseUrl:params.get('courseUrl') || null};
// Clear source address from the visible tab URL after reading it.
history.replaceState(null, '', location.pathname);
async function process(bytes, source) {
  material = undefined; save.disabled = txt.disabled = true;
  document.getElementById('preview').replaceChildren();
  const size = bytes.length;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const pages = await extractPages(bytes, (page,total)=>{status.textContent=`Extraindo página ${page} de ${total}…`;});
  material = {schemaVersion:1, extensionVersion:'0.2.0', importedAt:new Date().toISOString(), source, course:{name:metadata.course,url:metadata.courseUrl}, file:{name:metadata.name,bytes:size,sha256},pageCount:pages.length,pages};
  const empty = pages.filter(page=>page.needsOcr).length;
  status.textContent=`Concluído: ${pages.length} páginas; ${pages.reduce((n,p)=>n+p.text.length,0)} caracteres.\n${empty} página(s) sem texto extraível: podem exigir OCR. A ordem de colunas e tabelas pode precisar de revisão.`;
  for(const page of pages) {
    const details=document.createElement('details'); const summary=document.createElement('summary');
    summary.textContent=`Página ${page.page}${page.needsOcr?' · sem texto extraível':''}`;
    const pre=document.createElement('pre');pre.textContent=page.text || '(Sem texto extraível)';
    details.append(summary,pre);document.getElementById('preview').append(details);
  }
  save.disabled=txt.disabled=false;
}
function fail(error){status.textContent=`Falha: ${error.message}. Você pode testar o arquivo já salvo usando a opção acima.`;}
function download(content,type,extension){
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');
 a.href=url;a.download=metadata.name.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]/g,'_')+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
save.onclick=()=>{if(material)download(JSON.stringify(material,null,2),'application/json','.material.json');};
txt.onclick=()=>{if(material)download(material.pages.map(p=>`Página ${p.page}\n${p.text}`).join('\n\n'),'text/plain;charset=utf-8','.txt');};
fileInput.onchange=async()=>{
 const file=fileInput.files[0];if(!file)return;fileInput.disabled=true;
 try{if(file.size>25*1024*1024)throw new Error('Limite de 25 MB.');metadata.name=file.name;metadata.course=null;metadata.courseUrl=null;await process(new Uint8Array(await file.arrayBuffer()),'arquivo-local');}catch(e){fail(e);}finally{fileInput.disabled=false;}
};
const source=params.get('source');
if(source){
 fileInput.disabled=true;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
 try{
  const url=new URL(source);
  if(url.origin!=='https://bb.cruzeirodosulvirtual.com.br'||!url.pathname.startsWith('/bbcswebdav/'))throw new Error('Endereço fora do escopo.');
  url.searchParams.delete('render');url.searchParams.delete('isInlineRender');url.searchParams.set('xythos-download','true');
  status.textContent='Recebendo o PDF completo…';
  const bytes=await readFullPdf(await fetch(url.href,{credentials:'include',signal:controller.signal}));
  clearTimeout(timer);await process(bytes,'blackboard');
 }catch(e){fail(e);}finally{clearTimeout(timer);controller.abort();fileInput.disabled=false;}
}else{status.textContent='Selecione um PDF local para testar a extração.';}
