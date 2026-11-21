import { useEffect, useRef, useState, type RefObject } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import crawl from '../generated/course-crawler.json';
import { downloadUrl, isBlackboardPage } from '../blackboard/scanner';
import { courseUrl, pageCourse, verifyCrawlCourse, fileNavigation, samePage, directResource, fullPdf, materials, type Acervo } from './protocol';
import type { PdfHandle } from './PdfExtractor';
const wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
export function useCourseImport(web:RefObject<WebView<object>|null>,pdf:RefObject<PdfHandle|null>,navigate:(url:string)=>void){
 const [diagnostic,setDiagnostic]=useState<object|null>(null);
 const [running,setRunning]=useState(false),[status,setStatus]=useState(''),[report,setReport]=useState<Acervo|null>(null);
 const abort=useRef<AbortController|null>(null),reportRef=useRef<Acervo|null>(null);
 const pending=useRef<{id:string;resolve:(v:unknown)=>void;reject:(e:Error)=>void}|null>(null);
 const selectedCourse=useRef<string|null>(null),selectionVersion=useRef(0);
 const directUrls=useRef(new Map<string,string>());
 const dataFile=new File(Paths.document,'cola-ai-acervo-disciplina.json');
 useEffect(()=>()=>{selectionVersion.current++;abort.current?.abort();},[]);
 async function stored(course:string):Promise<Acervo|null>{
  const folder=new Directory(Paths.document,'cola-ai-acervos');
  const file=new File(folder,encodeURIComponent(new URL(course).pathname)+'.json');
  const candidate=file.exists?file:dataFile;
  if(!candidate.exists)return null;
  const d=JSON.parse(await candidate.text()) as Acervo;
  return d.source==='blackboard-batch'&&pageCourse(d.course.url)===course?d:null;
 }
 function navigation(url:string){
  if(abort.current)return;
  const next=pageCourse(url);if(next===selectedCourse.current)return;
  selectedCourse.current=next;const version=++selectionVersion.current;
  reportRef.current=null;setReport(null);setDiagnostic(null);setStatus(next?'Disciplina aberta. Toque em Importar disciplina para buscar seus materiais.':'Abra o Conteúdo da disciplina que deseja importar.');
  if(next)void stored(next).then(d=>{if(version===selectionVersion.current&&!abort.current&&selectedCourse.current===next){reportRef.current=d;setReport(d);}}).catch(()=>{if(version===selectionVersion.current)setStatus('Não foi possível recuperar o acervo desta disciplina. Você pode importar novamente.');});
 }

 const publish=(d:Acervo)=>{reportRef.current=d;setReport({...d,files:d.files.map(f=>({...f}))});};
 const save=async(d:Acervo)=>{
  const json=JSON.stringify(d);if(new TextEncoder().encode(json).length>20*1024*1024)throw Error('O acervo excedeu 20 MB de texto.');
  const folder=new Directory(Paths.document,'cola-ai-acervos');folder.create({idempotent:true,intermediates:true});
  await new File(folder,encodeURIComponent(new URL(d.course.url).pathname)+'.json').write(json);
  await dataFile.write(json);
 };
 function rpc(script:string,signal:AbortSignal,timeout=15000):Promise<unknown>{
  return new Promise((resolve,reject)=>{
   if(signal.aborted){reject(Error('Importação interrompida.'));return;}
   const id=String(Date.now())+'-'+Math.random().toString(36).slice(2);
   const cancel=()=>finish(()=>reject(Error('Importação interrompida.')));
   const timer=setTimeout(()=>finish(()=>reject(Error('A página não respondeu a tempo.'))),timeout);
   const finish=(fn:()=>void)=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);pending.current=null;fn();};
   pending.current={id,resolve:v=>finish(()=>resolve(v)),reject:e=>finish(()=>reject(e))};
   signal.addEventListener('abort',cancel,{once:true});
   web.current?.injectJavaScript(`(async()=>{try{const value=await (async()=>{${script}})();window.ReactNativeWebView.postMessage(JSON.stringify({kind:'cola-import',id:${JSON.stringify(id)},value}));}catch{window.ReactNativeWebView.postMessage(JSON.stringify({kind:'cola-import',id:${JSON.stringify(id)},error:true}));}})();true;`);
  });
 }
 function message(e:WebViewMessageEvent):boolean{
  if(!isBlackboardPage(e.nativeEvent.url))return false;
  try{const d=JSON.parse(e.nativeEvent.data);if(d.kind!=='cola-import')return false;
   const p=pending.current;if(p&&p.id===d.id){if(d.error)p.reject(Error('Falha ao ler a página da disciplina.'));else p.resolve(d.value);}return true;
  }catch{return false;}
 }
 async function resource(url:string,signal:AbortSignal):Promise<string>{
  navigate(fileNavigation(url));
  let observed='sem resposta da página';
  const deadline=Date.now()+35000;
  while(Date.now()<deadline){
   if(signal.aborted)throw Error('Importação interrompida.');
   await wait(700);
   try{
    const raw=await rpc(`if(location.origin!=='https://bb.cruzeirodosulvirtual.com.br')return null;
      return {page:location.href,resourceCount:document.querySelectorAll('iframe[src],embed[src],object[data]').length,pdfUrl:[...document.querySelectorAll('iframe[src],embed[src],object[data]')].map(e=>e.src||e.data).find(u=>{try{const x=new URL(u,location.href);return x.origin===location.origin&&x.pathname.startsWith('/bbcswebdav/');}catch{return false;}})||null};`,signal,4000) as {page?:string;pdfUrl?:string;resourceCount?:number}|null;
    if(raw?.page){
     observed=samePage(raw.page,url)?`visualizador aberto; ${raw.resourceCount||0} recurso(s), sem endereço PDF reconhecido`:'a navegação não chegou ao visualizador do arquivo';
     if(samePage(raw.page,url)&&raw.pdfUrl)return downloadUrl(raw.pdfUrl);
    }
   }catch{if(signal.aborted)throw Error('Importação interrompida.');}
  }
  throw Error('PDF não localizado: '+observed+'.');
 }
 async function start(current:string,title:string,resume=false,limit=100){
  if(abort.current)return;
  const control=new AbortController();abort.current=control;const signal=control.signal;
  selectionVersion.current++;reportRef.current=null;setReport(null);setDiagnostic(null);directUrls.current.clear();
  setRunning(true);setStatus('Identificando a disciplina aberta…');
  let d:Acervo|null=null,course:string|null=null;let discoveredLinks:unknown[]=[];
  try{
   // Read the live page, not a possibly stale iOS navigation callback.
   const context=await rpc('return {url:location.href,title:document.title};',signal) as {url?:string;title?:string};
   course=courseUrl(context.url||'');selectedCourse.current=course;
   title=context.title||title;
   setStatus('Abrindo pastas de '+title+'…');
   if(resume){d=await stored(course);if(!d)throw Error('Não há lote salvo desta disciplina para retomar. Use Importar disciplina.');
    if(d.files.some(f=>f.kind==='direct'&&f.status!=='concluido')){
     const refreshed=await rpc(crawl.script+'\nreturn await crawlCourse();',signal,110000) as {page?:{url?:string};links?:unknown[]};
     verifyCrawlCourse(course,refreshed.page?.url);discoveredLinks=refreshed.links||[];
    }
   }
   else{
    const result=await rpc(crawl.script+'\nreturn await crawlCourse();',signal,110000) as {error?:string;links?:unknown;coverage?:string;reason?:string;failures?:unknown[];opened?:string[];observedLinks?:unknown[];pdfControls?:unknown[];frames?:unknown[];page?:{title?:string;url?:string}};
    if(result.error)throw Error(result.error);
    verifyCrawlCourse(course,result.page?.url);
    discoveredLinks=Array.isArray(result.links)?result.links:[];
    const cleanLinks=(items:unknown[]|undefined)=>(items||[]).slice(0,300).flatMap(item=>{try{const x=item as {url?:string;label?:string};if(!x.url)return [];const u=new URL(x.url);return [{label:typeof x.label==='string'?x.label.slice(0,200):'',url:u.origin+u.pathname}];}catch{return [];}});
    setDiagnostic({source:'blackboard-mobile-discovery',version:6,capturedAt:new Date().toISOString(),course:{url:course,title:result.page?.title||title},reason:result.reason,opened:result.opened||[],links:cleanLinks(result.links as unknown[]),observedLinks:cleanLinks(result.observedLinks),pdfControls:result.pdfControls||[],frames:cleanLinks(result.frames)});
    d={schemaVersion:1,source:'blackboard-batch',importedAt:new Date().toISOString(),course:{url:course,title:result.page?.title||title||'Disciplina'},discovery:{unsupported:discoveredLinks.flatMap(link=>{const x=link as {type?:string;label?:string;url?:string};if(x.type!=='arquivo-nao-pdf'||!x.url)return [];const u=new URL(x.url);return [{label:x.label||'Arquivo não PDF',url:u.origin+u.pathname}];}),coverage:result.coverage||'nao-confirmada',reason:result.reason||'desconhecida',failures:result.failures||[],opened:result.opened||[]},coverage:'nao-confirmada',files:materials(course,result.links),processingComplete:false};
   }
   for(const link of (discoveredLinks||[])){
    try{const raw=link as {url:string;observedCourse?:string};const u=new URL(raw.url);
     if(isBlackboardPage(u.href)&&u.pathname.startsWith('/bbcswebdav/')&&pageCourse(raw.observedCourse||'')===course)directUrls.current.set(u.origin+u.pathname,u.href);
    }catch{}
   }
   publish(d);await save(d);
   const folder=new Directory(Paths.document,'cola-ai-pdfs');folder.create({idempotent:true,intermediates:true});
   let totalBytes=d.files.filter(f=>f.status==='concluido').reduce((n,f)=>n+(f.bytes||0),0);
   let chars=d.files.reduce((n,f)=>n+(f.pages?.reduce((x,p)=>x+p.text.length,0)||0),0);
   let attempted=0,discoveryFailures=0;
   for(let i=0;i<d.files.length;i++){
    if(signal.aborted)break;
    const item=d.files[i];if(item.status==='concluido')continue;
    if(attempted>=limit)break;attempted++;
    item.status='processando';delete item.error;publish(d);
    const label=`${i+1}/${d.files.length} · ${item.name}`;
    const fileControl=new AbortController();const stop=()=>fileControl.abort();signal.addEventListener('abort',stop,{once:true});
    const timer=setTimeout(stop,180000);
    try{
     setStatus(label+': abrindo PDF…');const url=item.kind==='direct'?directResource(course,item,directUrls.current.get(item.sourcePage)):await resource(item.sourcePage,fileControl.signal);
     setStatus(label+': baixando arquivo completo…');
     const response=await fetch(url,{credentials:'include',signal:fileControl.signal});
     const length=Number(response.headers.get('content-length')||0);if(length>25*1024*1024)throw Error('PDF acima de 25 MB.');
     const bytes=new Uint8Array(await response.arrayBuffer());fullPdf(bytes,response.status);
     if(totalBytes+bytes.length>250*1024*1024)throw Error('Limite de 250 MB por disciplina atingido.');
     const file=new File(folder,encodeURIComponent(new URL(item.sourcePage).pathname)+'.pdf');await file.write(bytes);
     if(!pdf.current)throw Error('Leitor PDF não disponível.');
     const pages=await pdf.current.extract(await file.base64(),fileControl.signal,(page,total)=>setStatus(label+`: extraindo página ${page}/${total}…`));
     const added=pages.reduce((n,p)=>n+p.text.length,0);if(chars+added>15_000_000)throw Error('Limite de texto do acervo atingido.');
     item.pages=pages;item.pageCount=pages.length;item.pagesNeedingOcr=pages.filter(p=>p.needsOcr).length;item.bytes=bytes.length;item.status='concluido';chars+=added;totalBytes+=bytes.length;
    }catch(e){item.status=signal.aborted?'cancelado':'falhou';item.error=fileControl.signal.aborted?(signal.aborted?'Interrompido pelo aluno.':'Tempo limite do arquivo.'):(e as Error).message;}
    finally{clearTimeout(timer);signal.removeEventListener('abort',stop);}
    publish(d);await save(d);
    discoveryFailures=item.error?.startsWith('PDF não localizado:')?discoveryFailures+1:0;
    if(discoveryFailures>=2){setStatus('Dois visualizadores não abriram. Lote interrompido para diagnóstico.');break;}
   }
   d.processingComplete=d.files.every(f=>f.status==='concluido');publish(d);await save(d);
   setStatus(`Lote ${signal.aborted?'interrompido':'encerrado'}: ${d.files.filter(f=>f.status==='concluido').length}/${d.files.length} importados. Cobertura total não confirmada.`);
  }catch(e){setStatus((e as Error).message);}
  finally{abort.current=null;setRunning(false);if(d&&course){navigate(course);}}
 }
 async function shareDiagnostic(){try{if(!diagnostic)return;const file=new File(Paths.cache,'cola-ai-disciplina-diagnostico-mobile.json');await file.write(JSON.stringify(diagnostic,null,2));if(!await Sharing.isAvailableAsync())throw Error('Compartilhamento não disponível.');await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json'});}catch(e){setStatus((e as Error).message);}}
 function stop(){abort.current?.abort();web.current?.injectJavaScript('if(window.__colaCrawler)window.__colaCrawler.stop=true;true;');}
 async function share(){try{if(!reportRef.current)return;await save(reportRef.current);if(!await Sharing.isAvailableAsync())throw Error('Compartilhamento não disponível.');await Sharing.shareAsync(dataFile.uri,{mimeType:'application/json',UTI:'public.json',dialogTitle:'Salvar acervo da disciplina'});}catch(e){setStatus((e as Error).message);}}
 return {running,status,report,diagnostic,shareDiagnostic,start,stop,share,message,navigation};
}
