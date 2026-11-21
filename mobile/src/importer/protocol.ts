import { BLACKBOARD_ORIGIN, downloadUrl, isBlackboardPage } from '../blackboard/scanner';
export type PageText = {page:number;text:string;needsOcr:boolean};
export type Material = {kind?:'direct';sourceCourse?:string;name:string;sourcePage:string;status:'pendente'|'processando'|'concluido'|'falhou'|'cancelado';pages?:PageText[];pageCount?:number;pagesNeedingOcr?:number;error?:string;bytes?:number};
export type Discovery = {unsupported?:{label:string;url:string}[];coverage:string;reason:string;failures:unknown[];opened?:string[]};
export type Acervo = {schemaVersion:1;source:'blackboard-batch';importedAt:string;course:{url:string;title:string};discovery:Discovery;coverage:'nao-confirmada';files:Material[];processingComplete:boolean};
export function courseUrl(value:string):string {
  const u=new URL(value);
  if(!isBlackboardPage(value)||!/^\/ultra\/courses\/[^/]+\/outline\/?$/.test(u.pathname))throw Error('Abra a aba Conteúdo de uma disciplina antes de importar.');
  return u.origin+u.pathname;
}
export function pageCourse(value:string):string|null {
 try{const u=new URL(value),match=/^\/ultra\/courses\/([^/]+)(?:\/|$)/.exec(u.pathname);return isBlackboardPage(value)&&match?u.origin+'/ultra/courses/'+match[1]+'/outline':null;}catch{return null;}
}
export function verifyCrawlCourse(expected:string,actual:unknown):void {
 if(typeof actual!=='string'||courseUrl(actual)!==courseUrl(expected))throw Error('A disciplina mudou durante a busca. Abra o Conteúdo da disciplina desejada e importe novamente.');
}
export function samePage(a:string,b:string):boolean {
  try {const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch{return false;}
}
export function fileNavigation(value:string):string {
  const u=new URL(value);
  const match=/^\/ultra\/courses\/([^/]+)\/(?:file\/[^/]+|(?:outline\/(?:edit\/)?)?document\/[^/]+)\/?$/.exec(u.pathname);
  if(!isBlackboardPage(value)||!match)throw Error('Página de arquivo inválida.');
  // Blackboard file routes use courseId when opened outside the current SPA state.
  u.search='';u.hash='';u.searchParams.set('courseId',match[1]);return u.href;
}
export function materials(course:string,raw:unknown):Material[] {
  const u=new URL(courseUrl(course));
  if(!Array.isArray(raw))throw Error('Lista de arquivos inválida.');
  const prefix=u.pathname.replace(/outline\/?$/,'');
  const seen=new Set<string>();const result:Material[]=[];
  for(const item of raw){
    if(!item||typeof item!=='object'||typeof item.url!=='string'||typeof item.label!=='string')continue;
    let link;try{link=new URL(item.url)}catch{continue}
    const direct=link.pathname.startsWith('/bbcswebdav/')&&(/\.pdf\b/i.test(item.label)||/\.pdf$/i.test(link.pathname));
    const page=link.pathname.startsWith(prefix)&&/^\/ultra\/courses\/[^/]+\/(?:file\/[^/]+|(?:outline\/(?:edit\/)?)?document\/[^/]+)\/?$/.test(link.pathname);
    if(link.origin!==BLACKBOARD_ORIGIN||(!direct&&!page))continue;
    // Direct resources have no course ID in their path: require observed course provenance.
    if(direct&&(typeof item.observedCourse!=='string'||pageCourse(item.observedCourse)!==courseUrl(course)))continue;
    const url=link.origin+link.pathname;
    if(seen.has(url))continue;seen.add(url);
    result.push({name:item.label.slice(0,300),sourcePage:url,status:'pendente',...(direct?{kind:'direct' as const,sourceCourse:courseUrl(course)}:{})});
  }
  if(!result.length)throw Error('Nenhum arquivo foi reconhecido neste formato de conteúdo. Salve o diagnóstico da disciplina em Ações para verificar os links encontrados.');
  if(result.length>100)throw Error('Limite de 100 arquivos por disciplina neste protótipo.');
  return result;
}
export function directResource(course:string,item:Material,candidate?:string):string {
 if(item.kind!=='direct'||item.sourceCourse!==courseUrl(course))throw Error('Recurso direto sem origem confirmada na disciplina.');
 const url=new URL(candidate||item.sourcePage),source=new URL(item.sourcePage);
 if(url.origin!==source.origin||url.pathname!==source.pathname)throw Error('Recurso diferente do arquivo encontrado.');
 return downloadUrl(url.href);
}
export function fullPdf(bytes:Uint8Array,status:number):void {
  if(status!==200)throw Error('O servidor não entregou o PDF completo.');
  if(bytes.length>25*1024*1024)throw Error('PDF acima do limite de 25 MB.');
  if(!Array.from(bytes.slice(0,1024),b=>String.fromCharCode(b)).join('').includes('%PDF-'))throw Error('O download não retornou um PDF.');
}
export function validatePages(raw:unknown):PageText[]{
  if(!Array.isArray(raw)||!raw.length||raw.length>500)throw Error('Contagem de páginas inválida.');
  let count=0;
  return raw.map((p,i)=>{
    if(!p||p.page!==i+1||typeof p.text!=='string')throw Error('Página inválida na extração.');
    count+=p.text.length;if(count>5_000_000)throw Error('Texto do PDF excede o limite.');
    return {page:i+1,text:p.text,needsOcr:!p.text.trim()};
  });
}
