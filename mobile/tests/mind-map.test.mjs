import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/mindmap/model.ts'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const scope={module:{exports:{}},exports:{}};vm.runInNewContext(code,scope);const {validateMap,mapLayout,mindMapSvg}=scope.module.exports;
const fixture={courseKey:'a'.repeat(64),createdAt:'2026-11-22T10:00:00Z',summaryCreatedAt:'2026-11-20T10:00:00Z',model:'fake',map:{title:'Engenharia de Software',themes:[{label:'Requisitos',topics:[{label:'Funcionais',references:[{documentId:'D1',page:1}]},{label:'Qualidade',references:[{documentId:'D1',page:2}]}]},{label:'Testes',topics:[{label:'Validação',references:[{documentId:'D1',page:3}]}]}]}};
test('map is tied to selected course and version of summary',()=>{
 assert.equal(validateMap(fixture,fixture.courseKey,fixture.summaryCreatedAt),fixture);
 assert.throws(()=>validateMap(fixture,'b'.repeat(64),fixture.summaryCreatedAt));assert.throws(()=>validateMap(fixture,fixture.courseKey,'2026-11-21T10:00:00Z'));
});
test('paragraphs are rejected instead of silently truncated',()=>{
 const d=structuredClone(fixture);d.map.themes[0].topics[0].label='Este parágrafo contém explicações demais para aparecer dentro de um mapa mental';
 assert.throws(()=>validateMap(d,d.courseKey,d.summaryCreatedAt));
});
test('layout keeps all nodes within canvas and without overlapping labels at maximum size',()=>{
 const map={title:'Disciplina',themes:Array.from({length:8},(_,i)=>({label:'Tema '+i,topics:Array.from({length:5},(_,j)=>({label:'Tópico '+j,references:[]}))}))};
 const l=mapLayout(map);assert.equal(l.nodes.length,49);
 for(const n of l.nodes){assert.ok(n.x>=0&&n.y>=0&&n.x+n.width<=l.width&&n.y+n.height<=l.height);}
 for(let i=0;i<l.nodes.length;i++)for(let j=i+1;j<l.nodes.length;j++){const a=l.nodes[i],b=l.nodes[j];assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));}
});
test('standalone vector image escapes labels and does not embed PDF or external assets',()=>{
 const map=structuredClone(fixture.map);map.title='<script>& teste';const svg=mindMapSvg(map);
 assert.ok(svg.includes('&lt;script&gt;&amp;'));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<image'));assert.ok(svg.startsWith('<svg'));
 assert.ok(svg.includes('Funcionais'));assert.ok(svg.includes('Validação'));assert.ok(!svg.includes('application/pdf'));
});
