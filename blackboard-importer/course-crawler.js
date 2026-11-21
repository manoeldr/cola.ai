async function crawlCourse() {
  if (window.__colaCrawler?.running) return {error:'Já existe uma varredura em andamento nesta página.'};
  if (!/^\/ultra\/courses\/[^/]+\/outline\/?$/.test(location.pathname)) return {error:'Abra a página Conteúdo de uma disciplina.'};
  const state = window.__colaCrawler = {running:true,stop:false,opened:[],failures:[],links:[],headings:[],rounds:0};
  const started=Date.now(), originalUrl=location.href;
  const links=new Map(), attempts=new Map();
  const key=el=>[el.getAttribute('aria-controls')||'',el.getAttribute('id')||'',el.innerText||el.getAttribute('aria-label')||''].join('|');
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const visible=el=>el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
  const text=el=>(el.innerText||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,300);
  const scope=()=>document.querySelector('main,[role="main"]')||document.body;
  const collect=()=>{
    for(const a of scope().querySelectorAll('a[href]')){
      if(!visible(a))continue;
      try{const u=new URL(a.getAttribute('href'),location.href);
        if(u.origin!==location.origin||!u.pathname.startsWith('/ultra/courses/'))continue;
        const label=text(a);if(label)links.set(u.href,{label,url:u.href,type:/\/file\//.test(u.pathname)?'possivel-arquivo':/\/assessment\//.test(u.pathname)?'avaliacao':'navegacao-do-curso'});
      }catch{}
    }
    state.links=[...links.values()];
    state.headings=[...new Set([...scope().querySelectorAll('h1,h2,h3,[role="heading"]')].filter(visible).map(text).filter(Boolean))];
  };
  let stable=0, previous='';
  try{
    while(!state.stop && Date.now()-started<90000 && state.opened.length<150){
      if(location.href!==originalUrl){state.reason='pagina-alterada';break;}
      state.rounds++;collect();
      const candidates=[...scope().querySelectorAll('button[aria-expanded="false"],[role="button"][aria-expanded="false"],[role="treeitem"][aria-expanded="false"]')]
        .filter(el=>visible(el)&&(attempts.get(key(el))||0)<2&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&el.getAttribute('aria-haspopup')!=='menu')
        .filter(el=>el.hasAttribute('aria-controls')||el.getAttribute('role')==='treeitem');
      if(candidates.length){
        stable=0;
        for(const el of candidates.slice(0,8)){
          if(state.stop||Date.now()-started>=90000||state.opened.length>=150)break;
          if (!el.isConnected || el.getAttribute('aria-expanded') !== 'false') continue;
          const identity=key(el), controls=el.getAttribute('aria-controls');
          attempts.set(identity,(attempts.get(identity)||0)+1);
          const label=text(el)||controls;
          el.scrollIntoView({block:'center'});el.click();
          let confirmed=false;
          const deadline=Math.min(Date.now()+3500,started+90000);
          while(Date.now()<deadline&&!state.stop){
            await wait(250);
            const current=el.isConnected?el:[...scope().querySelectorAll('[aria-expanded]')].find(item=>key(item)===identity);
            if(current?.getAttribute('aria-expanded')==='true'){confirmed=true;break;}
            collect();
          }
          state.failures=state.failures.filter(item=>item.identity!==identity);
          if(confirmed){
            if(!state.opened.includes(label))state.opened.push(label);
            await wait(500);
          }else{
            const current=[...scope().querySelectorAll('[aria-expanded]')].find(item=>key(item)===identity);
            state.failures.push({identity,label,attempts:attempts.get(identity),controls,
              observedState:current?.getAttribute('aria-expanded')||'controle-nao-encontrado',
              targetPresent:!!(controls&&document.getElementById(controls)),
              reason:'Expansão não confirmada após espera; cobertura parcial.'});
          }
          collect();
        }
      }else{
        const containers=[document.scrollingElement,...scope().querySelectorAll('*')].filter(el=>el&&el.scrollHeight>el.clientHeight+50&&el.clientHeight>150&&(el===document.scrollingElement||/auto|scroll/.test(getComputedStyle(el).overflowY)));
        let moved=false;
        for(const el of containers){const before=el.scrollTop;el.scrollTop+=Math.max(200,el.clientHeight*.8);if(el.scrollTop!==before)moved=true;}
        await wait(900);collect();
        const snapshot=JSON.stringify([state.links.map(x=>x.url).sort(),state.headings]);
        stable=!moved&&snapshot===previous?stable+1:0;previous=snapshot;
        if(stable>=4){state.reason='sem-novos-itens-observados';break;}
      }
    }
    if(!state.reason)state.reason=state.stop?'cancelado':Date.now()-started>=90000?'limite-de-tempo':'limite-de-expansoes';
  }catch(error){state.reason='erro';state.failures.push({reason:String(error.message)});}
  finally{collect();state.running=false;}
  return {schemaVersion:1,source:'blackboard-course-crawl',page:{url:originalUrl,title:document.title},capturedAt:new Date().toISOString(),...state,coverage:state.failures.length?'parcial':'nao-confirmada',limitations:['Coleta de links, sem download ou extração nesta etapa.','Somente expansores com semântica acessível reconhecida.','Ausência de novos itens não garante cobertura completa.']};
}
