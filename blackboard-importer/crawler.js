const tabId=Number(new URLSearchParams(location.hash.slice(1)).get('tab'));
const status=document.getElementById('status'),report=document.getElementById('report');
let result;
document.getElementById('batch').onclick=async()=>{
 await chrome.storage.session.set({latestCourseCrawl:result});
 await chrome.tabs.create({url:chrome.runtime.getURL('batch.html')+'#latest'});
};
document.getElementById('stop').onclick=async()=>{
 try{await chrome.scripting.executeScript({target:{tabId},func:()=>{if(window.__colaCrawler)window.__colaCrawler.stop=true;}});}catch(e){status.textContent=e.message;}
};
document.getElementById('save').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='cola-ai-disciplina-diagnostico.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
};
const poll=setInterval(async()=>{
 try{const [response]=await chrome.scripting.executeScript({target:{tabId},func:()=>{const s=window.__colaCrawler;return s?{running:s.running,opened:s.opened.length,links:s.links.length}:null;}});
 if(response?.result)status.textContent=`${response.result.running?'Em andamento':'Finalizando'}: ${response.result.opened} expansões, ${response.result.links} links.`;}catch{}
},1200);
(async()=>{
 try{
  const tab=await chrome.tabs.get(tabId);
  if(new URL(tab.url).hostname!=='bb.cruzeirodosulvirtual.com.br')throw Error('Aba fora do Blackboard configurado.');
  const [response]=await chrome.scripting.executeScript({target:{tabId},func:crawlCourse});
  result={extensionVersion:chrome.runtime.getManifest().version,...response.result};
  if(result.error)throw Error(result.error);
  status.textContent=`Varredura encerrada: ${result.reason}. Cobertura ainda não confirmada.`;
  report.textContent=JSON.stringify({pastasAbertas:result.opened,possiveisArquivos:result.links.filter(x=>x.type==='possivel-arquivo'),falhas:result.failures},null,2);
  document.getElementById('save').disabled=false;
  document.getElementById('batch').disabled=false;
 }catch(e){status.textContent='Falha: '+e.message;}
 finally{clearInterval(poll);document.getElementById('stop').disabled=true;}
})();
