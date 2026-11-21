import {extractPages} from './text-extraction.mjs';
const $=id=>document.getElementById(id);
let manifest,report,stopped=false,controller,auxId;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function load(data){
 if(data.source!=='blackboard-course-crawl'||!Array.isArray(data.links))throw Error('Escolha o diagnóstico da varredura de disciplina.');
 const course=new URL(data.page.url);
 if(course.origin!=='https://bb.cruzeirodosulvirtual.com.br'||!/^\/ultra\/courses\/[^/]+\/outline\/?$/.test(course.pathname))throw Error('Disciplina inválida.');
 const coursePrefix=course.pathname.replace(/outline\/?$/,'file/');
 const seen=new Set();
 const files=data.links.filter(x=>x.type==='possivel-arquivo').filter(x=>{
   const u=new URL(x.url);
   if(u.origin!==course.origin||!u.pathname.startsWith(coursePrefix))throw Error('Arquivo fora da disciplina.');
   if(seen.has(u.href))return false;seen.add(u.href);return true;
 });
 if(!files.length||files.length>100)throw Error('O diagnóstico precisa conter de 1 a 100 arquivos.');
 manifest={data,files};$('start').disabled=false;
 $('status').textContent=`${files.length} arquivos prontos. Cobertura da descoberta: ${data.coverage || 'não confirmada'}.`;
}
$('manifest').onchange=async()=>{try{const f=$('manifest').files[0];if(f.size>2*1024*1024)throw Error('Diagnóstico excede 2 MB.');load(JSON.parse(await f.text()));}catch(e){$('start').disabled=true;$('status').textContent=e.message;}};
$('stop').onclick=()=>{stopped=true;controller?.abort();$('status').textContent='Parando; aguarde o relatório…';};
$('save').onclick=()=>{
 const u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=u;a.download='cola-ai-acervo-disciplina.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);
};
$('start').onclick=async()=>{
 if(!manifest)return;
 stopped=false;$('start').disabled=$('manifest').disabled=$('save').disabled=true;$('stop').disabled=false;$('items').replaceChildren();
 report={schemaVersion:1,extensionVersion:'0.4.0',source:'blackboard-batch',importedAt:new Date().toISOString(),course:manifest.data.page,discovery:{coverage:manifest.data.coverage,failures:manifest.data.failures||[],reason:manifest.data.reason},files:manifest.files.map(x=>({name:x.label,sourcePage:x.url,status:'pendente'}))};
 let totalChars=0;
 try{
  const tab=await chrome.tabs.create({url:'about:blank',active:false});auxId=tab.id;
  for(let i=0;i<report.files.length;i++){
   if(stopped)break;
   const item=report.files[i],li=document.createElement('li');$('items').append(li);
   const display=msg=>{li.textContent=`${i+1}/${report.files.length} · ${item.name}: ${msg}`;$('status').textContent=li.textContent;};
   controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120000);
   item.status='processando';display('abrindo arquivo…');
   try{
    await chrome.tabs.update(auxId,{url:item.sourcePage});
    let resource;
    for(let tries=0;tries<60;tries++){
     if(controller.signal.aborted)throw Error(stopped?'Cancelado':'Tempo limite.');
     await pause(500);
     try{
      const [r]=await chrome.scripting.executeScript({target:{tabId:auxId},func:()=>({url:location.href,resources:[...document.querySelectorAll('iframe[src],embed[src],object[data]')].map(el=>el.src||el.data)})});
      if(r?.result?.url!==item.sourcePage)continue;
      resource=r.result.resources.find(href=>{try{const u=new URL(href);return u.origin==='https://bb.cruzeirodosulvirtual.com.br'&&u.pathname.startsWith('/bbcswebdav/');}catch{return false;}});
      if(resource)break;
     }catch{/* Navigation may temporarily destroy the frame. */}
    }
    if(!resource)throw Error('Endereço do arquivo não encontrado após 30 segundos.');
    const u=new URL(resource);u.searchParams.delete('render');u.searchParams.delete('isInlineRender');u.searchParams.set('xythos-download','true');
    display('recebendo PDF…');
    const bytes=await readFullPdf(await fetch(u.href,{credentials:'include',signal:controller.signal}));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    item.bytes=bytes.length;item.sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const duplicate=report.files.find(x=>x!==item&&x.status==='concluido'&&x.sha256===item.sha256);
    if(duplicate){item.status='duplicado';item.duplicateOf=duplicate.sourcePage;display('conteúdo duplicado; referência preservada');continue;}
    item.pages=await extractPages(bytes,(page,total)=>display(`extraindo página ${page}/${total}…`),controller.signal);
    const chars=item.pages.reduce((n,p)=>n+p.text.length,0);totalChars+=chars;
    if(totalChars>15000000){delete item.pages;stopped=true;throw Error('Limite de 15 milhões de caracteres por lote atingido.');}
    item.pageCount=item.pages.length;item.pagesNeedingOcr=item.pages.filter(p=>p.needsOcr).length;item.status='concluido';
    display(`${item.pageCount} páginas; ${item.pagesNeedingOcr} sem texto extraível`);
   }catch(e){item.status=stopped?'cancelado':'falhou';item.error=controller.signal.aborted?(stopped?'Cancelado pelo aluno.':'Tempo limite por arquivo.'):String(e.message);display(item.error);}
   finally{clearTimeout(timer);controller.abort();}
  }
 }catch(e){report.error=String(e.message);}
 finally{
  if(auxId){await chrome.tabs.remove(auxId).catch(()=>{});auxId=undefined;}
  report.finishedAt=new Date().toISOString();report.summary={};
  for(const f of report.files)report.summary[f.status]=(report.summary[f.status]||0)+1;
  report.processingComplete=report.files.every(f=>['concluido','duplicado'].includes(f.status));
  report.coverage='nao-confirmada';
  $('status').textContent=`Lote encerrado: ${JSON.stringify(report.summary)}. Salve o acervo. A cobertura total da disciplina continua não confirmada.`;
  $('save').disabled=false;$('start').disabled=$('manifest').disabled=false;$('stop').disabled=true;
 }
};
if(location.hash==='#latest'){
 try{const data=await chrome.storage.session.get('latestCourseCrawl');if(data.latestCourseCrawl)load(data.latestCourseCrawl);}catch(e){$('status').textContent=e.message;}
}
