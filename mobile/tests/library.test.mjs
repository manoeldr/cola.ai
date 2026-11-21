import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const bundle=buildSync({entryPoints:['src/library/catalog.ts'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const scope={module:{exports:{}},exports:{},URL};vm.runInNewContext(bundle,scope);
const {catalog,selection}=scope.module.exports;
const ia={course:{url:'https://bb.test/ultra/courses/ia/outline',title:'IA'},files:[]};
const es={course:{url:'https://bb.test/ultra/courses/es/outline',title:'Engenharia de software'},files:[]};
const summary={course:{key:'ia-key',title:'IA'},result:{summary:{title:'IA summary'}},job:null};
test('new discipline does not display last summary from another course',()=>{
 const entries=catalog([ia,es],[summary]);
 const chosen=selection(entries,es.course.url);
 assert.equal(chosen.title,'Engenharia de software');assert.equal(chosen.study,null);
 assert.equal(selection(entries,ia.course.url).study.result.summary.title,'IA summary');
});
test('default selection follows current corpus rather than old summary',()=>{
 assert.equal(selection(catalog([ia,es],[summary]),undefined,undefined,es.course.url).title,'Engenharia de software');
});
test('both saved summaries remain addressable independently',()=>{
 const second={course:{key:'es-key',title:es.course.title},sourceUrl:es.course.url,result:{summary:{title:'ES summary'}}};
 const entries=catalog([ia,es],[summary,second]);assert.equal(entries.length,2);
 assert.equal(selection(entries,undefined,'ia-key').study.result.summary.title,'IA summary');
 assert.equal(selection(entries,es.course.url).study.result.summary.title,'ES summary');
});
test('unknown course does not fall back to unrelated summary',()=>{
 assert.equal(selection(catalog([ia],[summary]),'https://bb.test/ultra/courses/other/outline'),null);
});
test('ambiguous old titles do not attach legacy summary to wrong corpus',()=>{
 const entries=catalog([ia,{...es,course:{...es.course,title:'IA'}}],[summary]);
 assert.equal(selection(entries,ia.course.url).study,null);assert.equal(selection(entries,undefined,'ia-key').study.result.summary.title,'IA summary');
});
