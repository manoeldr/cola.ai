import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const script=JSON.parse(fs.readFileSync('src/generated/course-crawler.json','utf8')).script;
test('crawler observes document links and produces sanitized diagnostic URLs',async()=>{
 const base='https://bb.cruzeirodosulvirtual.com.br';const page=base+'/ultra/courses/_1_1/outline';
 let clock=0;const document={title:'Engenharia',baseURI:page,scrollingElement:null};
 const anchor={innerText:'Aula com PDF',textContent:'Aula com PDF',ownerDocument:document,getClientRects:()=>[{}],getAttribute:key=>key==='href'?base+'/ultra/courses/_1_1/outline/edit/document/_2_1?ticket=private':null};
 const direct={...anchor,innerText:'Aula ES.pdf',textContent:'Aula ES.pdf',getAttribute:key=>key==='href'?base+'/bbcswebdav/pid-1/xid-1?ticket=private':null};
 const root={querySelectorAll:selector=>selector==='a[href]'?[anchor,direct]:[]};
 document.body=root;document.querySelector=()=>root;
 const location={origin:base,href:page,pathname:new URL(page).pathname};
 const result=await vm.runInNewContext(script+'\ncrawlCourse();',{window:{},document,location,URL,Date:class extends Date{static now(){return clock;}},setTimeout:(fn,ms)=>{clock+=ms;fn();},getComputedStyle:()=>({visibility:'visible'})});
 assert.equal(result.links.length,2);assert.equal(result.links[0].type,'documento-com-anexos');
 assert.equal(result.observedLinks[0].url,base+'/ultra/courses/_1_1/outline/edit/document/_2_1');
 assert.equal(JSON.stringify(result.observedLinks).includes('private'),false);
 assert.equal(result.links[1].type,'arquivo-direto');assert.equal(result.links[1].observedCourse,page);
});
