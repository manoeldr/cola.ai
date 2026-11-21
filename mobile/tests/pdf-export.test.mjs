import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/export/summaryHtml.ts'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const scope={module:{exports:{}},exports:{}};vm.runInNewContext(code,scope);
const {summaryHtml,pdfFilename}=scope.module.exports;
const result={summary:{title:'Revisão & conceitos',sections:[{title:'Requisitos <funcionais>',text:'Primeiro parágrafo.\n\n<script>alert(1)</script>\nContinuação.',references:[{documentId:'D1',page:3}]}]},createdAt:'2026-11-20T12:00:00Z',documentCount:1,pageCount:10};
test('PDF includes justified prose, all sections and human-readable citations',()=>{
 const html=summaryHtml(result,'Engenharia de Software',[{id:'D1',name:'Aula 1.pdf'}]);
 assert.ok(html.includes('text-align:justify'));assert.ok(html.includes('size:A4'));assert.ok(html.includes('Aula 1.pdf'));assert.ok(html.includes('página 3'));assert.ok(html.includes('Materiais citados'));
 assert.equal((html.match(/<section>/g)||[]).length,1);
});
test('summary and filenames cannot inject HTML or load external assets',()=>{
 const html=summaryHtml(result,'Curso <img src=https://example.com>',[{id:'D1',name:'Fonte <svg onload=alert(1)>.pdf'}]);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<svg'));
});
test('missing citations block export rather than inventing a source',()=>{
 assert.throws(()=>summaryHtml(result,'Curso',[]));
 assert.equal(pdfFilename('Engenharia de Software / 2026'),'Cola-ai-Resumo-Engenharia-de-Software-2026.pdf');
});
