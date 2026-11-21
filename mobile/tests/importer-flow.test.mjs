import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/importer/useCourseImport.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['react','expo-file-system','expo-sharing']}).outputFiles[0].text;
const base='https://bb.cruzeirodosulvirtual.com.br';
const ia=base+'/ultra/courses/_ia_1/outline',es=base+'/ultra/courses/_es_1/outline',file=base+'/ultra/courses/_es_1/file/_pdf_1';
function scenario(actual,direct=false){
 const disk=new Map(),states=[],navigation=[],fetched=[];
 class File{constructor(...args){this.uri=args.map(a=>typeof a==='string'?a:a.uri).join('/');}get exists(){return disk.has(this.uri);}async text(){return disk.get(this.uri);}async write(value){disk.set(this.uri,value);}async base64(){return 'PDF';}}
 class Directory{constructor(...args){this.uri=args.join('/');}create(){}}
 const react={useRef:value=>({current:value}),useEffect:()=>{},useState:value=>{const i=states.length;states.push(value);return [value,v=>{states[i]=v;}];}};
 let api;
 const web={current:{injectJavaScript:script=>{
  const match=/id:("[^"]+")/.exec(script);if(!match)return;
  let value;
  if(script.includes('return {url:location.href,title:document.title}'))value={url:actual,title:'Engenharia de Software'};
  else if(script.includes('return await crawlCourse'))value={page:{url:es,title:'Engenharia de Software'},links:[direct?{url:base+'/bbcswebdav/pid-test/xid-test?ticket=private&render=inline',label:'Software.pdf',observedCourse:es}:{url:file,label:'Software.pdf'}],failures:[],reason:'sem-novos-itens-observados'};
  else value={page:file,pdfUrl:base+'/bbcswebdav/software.pdf',resourceCount:1};
  api.message({nativeEvent:{url:base,data:JSON.stringify({kind:'cola-import',id:JSON.parse(match[1]),value})}});
 }}};
 const scope={module:{exports:{}},exports:{},URL,TextEncoder,Uint8Array,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===700?0:ms),clearTimeout,
 fetch:async url=>{fetched.push(url);return {status:200,headers:{get:()=>null},arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7').buffer};},
 require:name=>name==='react'?react:name==='expo-file-system'?{File,Directory,Paths:{document:'/docs'}}:{isAvailableAsync:async()=>true,shareAsync:async()=>{}}};
 vm.runInNewContext(code,scope);
 api=scope.module.exports.useCourseImport(web,{current:{extract:async()=>[{page:1,text:'Requisitos de software',needsOcr:false}]}},url=>navigation.push(url));
 disk.set('/docs/cola-ai-acervo-disciplina.json',JSON.stringify({schemaVersion:1,source:'blackboard-batch',course:{url:ia,title:'IA'},files:[]}));
 return {api,states,disk,navigation,fetched};
}
test('import uses live Engineering page even when native callback still points to IA',async()=>{
 const {api,states,disk,navigation}=scenario(es);
 assert.equal(states.at(-1),null,'must not restore last IA report on mount');
 await api.start(ia,'old IA title');
 assert.equal(states.at(-1).course.url,es);assert.equal(states.at(-1).course.title,'Engenharia de Software');assert.equal(states.at(-1).files[0].status,'concluido');
 assert.equal(JSON.parse(disk.get('/docs/cola-ai-acervo-disciplina.json')).course.url,es);assert.equal(navigation.at(-1),es);
});
test('failed import does not expose previous IA report as a new result',async()=>{
 const {api,states,disk}=scenario(base+'/ultra/course');
 await api.start(ia,'IA');
 assert.equal(states.at(-1),null);assert.match(states.at(-2),/Conteúdo/);
 assert.equal(JSON.parse(disk.get('/docs/cola-ai-acervo-disciplina.json')).course.url,ia,'old corpus remains saved, not displayed as current result');
});

test('direct PDF downloads without navigating to an Ultra file page and never persists signed query',async()=>{
 const {api,states,disk,navigation,fetched}=scenario(es,true);
 await api.start(es,'Engineering');
 const result=states.at(-1);assert.equal(result.files[0].status,'concluido');assert.equal(result.files[0].kind,'direct');
 assert.equal(fetched.length,1);assert.equal(new URL(fetched[0]).searchParams.get('ticket'),'private');assert.equal(new URL(fetched[0]).searchParams.get('render'),null);
 assert.equal(navigation.length,1);assert.equal(navigation[0],es);
 assert.equal(disk.get('/docs/cola-ai-acervo-disciplina.json').includes('ticket'),false);
});
