import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {BLACKBOARD_ORIGIN as base,validateScan,downloadUrl,buildScanScript} from '../src/blackboard/scanner.ts';
test('bridge rejects foreign origin',()=>assert.throws(()=>validateScan('{}','https://example.com')));
test('links filtered and deduplicated',()=>{
 const url=base+'/ultra/courses/_1_1/outline';
 const link={label:'Matéria',url};
 const result=validateScan(JSON.stringify({kind:'cola-scan',title:'Curso',page:url,links:[link,link,{label:'externo',url:'https://example.com'}]}),url);
 assert.equal(result.links.length,1);assert.equal(result.links[0].type,'course');
});
test('download retains parameters and removes viewer flags',()=>{
 const u=new URL(downloadUrl(base+'/bbcswebdav/file?render=inline&isInlineRender=true&ticket=test'));
 assert.equal(u.searchParams.get('ticket'),'test');assert.equal(u.searchParams.get('render'),null);assert.equal(u.searchParams.get('xythos-download'),'true');
 assert.throws(()=>downloadUrl('https://example.com/bbcswebdav/file'));
});
test('injected script finds visible course and PDF iframe',()=>{
 let result;
 const url=base+'/ultra/courses/_1_1/outline';
 const anchor={getClientRects:()=>[{}],innerText:'Minha   matéria',getAttribute:()=>url};
 const frame={getAttribute:key=>key==='src'?base+'/bbcswebdav/file':null};
 vm.runInNewContext(buildScanScript(),{URL,location:{origin:base,href:url},document:{title:'Teste',querySelectorAll:selector=>selector==='a[href]'?[anchor]:[frame]},window:{ReactNativeWebView:{postMessage:value=>result=JSON.parse(value)}}});
 assert.equal(result.links[0].label,'Minha matéria');assert.equal(result.pdfUrl,base+'/bbcswebdav/file');
});
