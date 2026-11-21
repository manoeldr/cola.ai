import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/library/local.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['react-native','expo-file-system']}).outputFiles[0].text;
function storage(){
 const disk=new Map();const join=(args)=>args.map(x=>typeof x==='string'?x:x.uri).join('/').replace(/\/+/g,'/');
 class File{
  constructor(...parts){this.uri=join(parts);}get name(){return this.uri.split('/').at(-1);}get exists(){return disk.has(this.uri);}
  async text(){return disk.get(this.uri);}async write(text){disk.set(this.uri,text);}
 }
 class Directory{
  constructor(...parts){this.uri=join(parts);}get exists(){return [...disk.keys()].some(p=>p.startsWith(this.uri+'/'));}create(){}
  list(){return [...disk.keys()].filter(p=>p.startsWith(this.uri+'/')&&!p.slice(this.uri.length+1).includes('/')).map(p=>new File(p));}
 }
 function reopen(){const scope={module:{exports:{}},exports:{},URL,require:name=>name==='react-native'?{Platform:{OS:'ios'}}:{File,Directory,Paths:{document:'/docs'}}};vm.runInNewContext(code,scope);return scope.module.exports;}
 return {disk,reopen};
}
test('single-summary migration preserves IA after saving and reopening Software Engineering',async()=>{
 const {disk,reopen}=storage();
 const iaUrl='https://bb.test/ultra/courses/ia/outline',esUrl='https://bb.test/ultra/courses/es/outline';
 const old={course:{key:'a'.repeat(64),title:'IA'},job:null,result:{summary:{title:'IA summary'}}};
 const next={course:{key:'b'.repeat(64),title:'Software Engineering'},sourceUrl:esUrl,job:null,result:{summary:{title:'ES summary'}}};
 for(const [url,title] of [[iaUrl,'IA'],[esUrl,'Software Engineering']])disk.set('/docs/cola-ai-acervos/'+encodeURIComponent(new URL(url).pathname)+'.json',JSON.stringify({source:'blackboard-batch',course:{url,title},files:[]}));
 disk.set('/docs/cola-ai-study-state.json',JSON.stringify(old));
 await reopen().saveStudy(next);
 const restored=await reopen().listLibrary();
 assert.equal(restored.length,2);
 assert.equal(restored.find(e=>e.sourceUrl===iaUrl).study.result.summary.title,'IA summary');
 assert.equal(restored.find(e=>e.sourceUrl===esUrl).study.result.summary.title,'ES summary');
 await reopen().saveStudy({...old,sourceUrl:iaUrl,result:{summary:{title:'IA updated'}}});
 assert.equal((await reopen().listLibrary()).find(e=>e.sourceUrl===esUrl).study.result.summary.title,'ES summary');
});
