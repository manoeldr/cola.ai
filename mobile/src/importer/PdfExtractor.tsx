import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import engine from '../generated/pdf-engine.json';
import { validatePages, type PageText } from './protocol';
const html = '<!doctype html><meta name="viewport" content="width=device-width"><script>'+engine.script.replace(/<\/script/gi,'<\\/script')+`\n
window.parts=[];
window.extract=async function(id){
 let task;
 try{
  const raw=atob(window.parts.join(''));window.parts=[];
  const data=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
  task=pdfjsLib.getDocument({data,isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
  const doc=await task.promise;if(doc.numPages>500)throw Error('Mais de 500 páginas.');
  const pages=[];let chars=0;
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n),content=await page.getTextContent();
   const text=content.items.filter(x=>typeof x.str==='string').map(x=>x.str+(x.hasEOL?'\\n':' ')).join('').trim();
   chars+=text.length;if(chars>5000000)throw Error('Texto acima do limite.');
   pages.push({page:n,text,needsOcr:!text.trim()});page.cleanup();
   window.ReactNativeWebView.postMessage(JSON.stringify({kind:'progress',id,page:n,total:doc.numPages}));
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({kind:'result',id,pages}));
 }catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({kind:'error',id}));}
 finally{window.parts=[];if(task)await task.destroy();}
};window.ReactNativeWebView.postMessage(JSON.stringify({kind:'ready'}));true;</script>`;
export type PdfHandle={extract:(base64:string,signal:AbortSignal,progress:(page:number,total:number)=>void)=>Promise<PageText[]>};
export const PdfExtractor=forwardRef<PdfHandle>(function PdfExtractor(_,ref){
 const web=useRef<WebView<object>>(null);const ready=useRef(false);
 const pending=useRef<{id:string;resolve:(v:PageText[])=>void;reject:(e:Error)=>void;progress:(p:number,t:number)=>void}|null>(null);
 useImperativeHandle(ref,()=>({extract:async(base64,signal,progress)=>{
  if(!ready.current)throw Error('Leitor de PDF ainda está carregando. Tente novamente.');
  if(pending.current)throw Error('Já existe uma extração.');
  return new Promise<PageText[]>((resolve,reject)=>{
   const id=String(Date.now());
   const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);pending.current=null;ready.current=false;web.current?.reload();reject(Error('Extração cancelada.'));};
   signal.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(abort,120000);
   const finish=(fn:()=>void)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);pending.current=null;fn();};
   pending.current={id,progress,resolve:p=>finish(()=>resolve(p)),reject:e=>finish(()=>reject(e))};
   if(signal.aborted){abort();clearTimeout(timer);return;}
   web.current?.injectJavaScript('window.parts=[];true;');
   for(let i=0;i<base64.length;i+=128*1024)web.current?.injectJavaScript('window.parts.push('+JSON.stringify(base64.slice(i,i+128*1024))+');true;');
   web.current?.injectJavaScript('void window.extract('+JSON.stringify(id)+');true;');
  });
 }}),[]);
 return <View style={styles.reader} pointerEvents="none" accessibilityElementsHidden>
  <WebView<object> ref={web} source={{html}} javaScriptEnabled originWhitelist={['about:*']} onShouldStartLoadWithRequest={r=>r.url==='about:blank'}
   onError={()=>pending.current?.reject(Error('Falha no leitor local de PDF.'))}
   onMessage={event=>{try{const d=JSON.parse(event.nativeEvent.data);if(d.kind==='ready'){ready.current=true;return;}const p=pending.current;if(!p||d.id!==p.id)return;
    if(d.kind==='progress')p.progress(d.page,d.total);
    else if(d.kind==='result')p.resolve(validatePages(d.pages));
    else if(d.kind==='error')p.reject(Error('Não foi possível extrair o PDF. Ele pode estar protegido ou usar recursos incompatíveis.'));
   }catch{pending.current?.reject(Error('Resposta inválida do leitor PDF.'));}}}/>
 </View>;
});
const styles=StyleSheet.create({reader:{position:'absolute',width:1,height:1,opacity:0.01,bottom:0}});
