import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const output=buildSync({entryPoints:['src/importer/protocol.ts'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const scope={exports:{},module:{exports:{}},URL,Uint8Array};vm.runInNewContext(output,scope);
const {courseUrl,fileNavigation,samePage,materials,directResource,fullPdf,validatePages}=scope.module.exports;
const base='https://bb.cruzeirodosulvirtual.com.br',course=base+'/ultra/courses/_1_1/outline';
test('only discipline content page can start import',()=>{
 assert.equal(courseUrl(course+'?x=test'),course);
 for(const url of [base+'/ultra/course','https://example.com/ultra/courses/_1_1/outline',base+'/ultra/courses/_1_1/assessment/_2_1'])assert.throws(()=>courseUrl(url));
});
test('file queue excludes assessments, foreign courses and duplicates',()=>{
 const file={url:base+'/ultra/courses/_1_1/file/_2_1',label:'Material.pdf'};
 const queue=materials(course,[file,{...file,url:file.url+'?token=private'},{...file,url:base+'/ultra/courses/_other/file/_2_1'},{...file,url:base+'/ultra/courses/_1_1/assessment/_2_1'},{...file,url:'https://example.com/file'}]);
 assert.equal(queue.length,1);assert.equal(queue[0].sourcePage,file.url);assert.equal(queue[0].status,'pendente');
});
test('empty and oversized discovery do not start batch',()=>{
 assert.throws(()=>materials(course,[]));
 assert.throws(()=>materials(course,Array.from({length:101},(_,i)=>({url:base+`/ultra/courses/_1_1/file/_${i}_1`,label:'PDF'}))));
});
test('probe HTTP206 is insufficient for full file import',()=>{
 const pdf=new TextEncoder().encode('%PDF-1.7 test');fullPdf(pdf,200);
 assert.throws(()=>fullPdf(pdf,206));assert.throws(()=>fullPdf(new TextEncoder().encode('<html>login</html>'),200));
});
test('page validation preserves page order and marks missing text for OCR',()=>{
 const pages=validatePages([{page:1,text:'Neural networks'},{page:2,text:'   '}]);
 assert.equal(pages[0].needsOcr,false);assert.equal(pages[1].needsOcr,true);
 assert.throws(()=>validatePages([{page:2,text:'wrong order'}]));assert.throws(()=>validatePages([]));
});

test('direct file navigation supplies course context without copying private query',()=>{
 const url=base+'/ultra/courses/_1_1/file/_2_1';
 assert.equal(fileNavigation(url+'?ticket=private'),url+'?courseId=_1_1');
 assert.equal(samePage(url+'/?courseId=_1_1#viewer',url),true);
 assert.equal(samePage(url,base+'/ultra/courses/_1_1/outline'),false);
 assert.throws(()=>fileNavigation('https://example.com/ultra/courses/_1_1/file/_2_1'));
});
test('document wrappers with PDF attachments are candidates within their own course',()=>{
 const url=base+'/ultra/courses/_1_1/outline/edit/document/_3_1';
 const queue=materials(course,[{label:'Aula com anexos',url},{label:'Prova.pdf',url:base+'/ultra/courses/_1_1/assessment/_4_1'},{label:'Outra disciplina',url:base+'/ultra/courses/_other/outline/edit/document/_3_1'}]);
 assert.equal(queue.length,1);assert.equal(queue[0].sourcePage,url);
 assert.equal(fileNavigation(url),url+'?courseId=_1_1');
});

test('direct Blackboard PDFs require observed course provenance and exclude DOCX',()=>{
 const pdf={label:'Aula 1.pdf',url:base+'/bbcswebdav/pid-1/xid-1?ticket=private',observedCourse:course};
 const queue=materials(course,[pdf,{...pdf,label:'Modelo.docx',url:base+'/bbcswebdav/pid-2/xid-2'},{...pdf,url:base+'/bbcswebdav/pid-3/xid-3',observedCourse:base+'/ultra/courses/_other/outline'}]);
 assert.equal(queue.length,1);assert.equal(queue[0].kind,'direct');assert.equal(queue[0].sourcePage.includes('?'),false);
 assert.equal(new URL(directResource(course,queue[0],pdf.url)).searchParams.get('ticket'),'private');
 assert.throws(()=>directResource(base+'/ultra/courses/_other/outline',queue[0],pdf.url));
 assert.throws(()=>directResource(course,queue[0],base+'/bbcswebdav/different'));
});
