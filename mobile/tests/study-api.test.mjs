import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const bundle=buildSync({entryPoints:['src/study/api.ts'],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
let fetchImpl;
const scope={module:{exports:{}},exports:{},URL,AbortController,setTimeout,clearTimeout,TypeError,fetch:(...args)=>fetchImpl(...args)};
vm.runInNewContext(bundle,scope);
const {connection,request,ApiError}=scope.module.exports;
const token='a'.repeat(64);
test('connection accepts private Mac address and rejects credential URLs',()=>{
 assert.equal(connection('http://192.168.1.10:5180',token).url,'http://192.168.1.10:5180');
 for(const url of ['http://example.com','http://127.0.0.1:5180','http://192.168.1.10?token=secret','http://user:password@192.168.1.10'])assert.throws(()=>connection(url,token));
 assert.throws(()=>connection('http://192.168.1.10','Gemini-key'));
});
test('API sends access code in header and uploads JSON without cookies',async()=>{
 let options;fetchImpl=async(url,opt)=>{assert.equal(url,'http://192.168.1.10:5180/api/mobile/courses/import');options=opt;return {status:200,ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({key:'course'})};};
 await request(connection('http://192.168.1.10:5180',token),'/courses/import','POST','{}');
 assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.credentials,'omit');assert.equal(options.body,'{}');
});
test('lost jobs have a distinct error for restart recovery',async()=>{
 fetchImpl=async()=>({status:404,ok:false});
 await assert.rejects(()=>request(connection('http://192.168.1.10',token),'/jobs/missing'),e=>e instanceof ApiError&&e.status===404);
});

test('HTML from Expo or wrong server gets actionable error without exposing body',async()=>{
 fetchImpl=async()=>({status:200,ok:true,headers:{get:()=> 'text/html'},text:async()=>'<html>private-page-content</html>'});
 await assert.rejects(()=>request(connection('http://192.168.1.10:8081',token),'/health'),e=>e.message.includes('5180')&&e.message.includes('8081')&&!e.message.includes('private-page-content'));
});
test('invalid JSON response reports backend diagnostic',async()=>{
 fetchImpl=async()=>({status:200,ok:true,headers:{get:()=> 'application/json'},text:async()=>'{invalid'});
 await assert.rejects(()=>request(connection('http://192.168.1.10:5180',token),'/health'),e=>e.message.includes('JSON inválido'));
});
