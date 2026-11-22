import type { Citation } from '../study/api';
export type MindMapTopic={label:string;brief:string;explanation:string;references:Citation[]};
export type MindMap={title:string;themes:{label:string;topics:MindMapTopic[]}[]};
export type MindMapResult={map:MindMap;courseKey:string;model:string;createdAt:string;summaryCreatedAt:string};
export function hasExplanations(value:MindMapResult):boolean{return !!value?.map?.themes?.length&&value.map.themes.every(t=>t.topics?.length&&t.topics.every(p=>typeof p.brief==='string'&&!!p.brief.trim()&&typeof p.explanation==='string'&&!!p.explanation.trim()));}
export function validateMap(value:MindMapResult,key:string,summaryDate:string):MindMapResult{
 if(!value||value.courseKey!==key||new Date(value.summaryCreatedAt).getTime()!==new Date(summaryDate).getTime())throw Error('Este mapa pertence a outra versão do resumo. Atualize a revisão da disciplina antes de gerar o mapa.');
 const label=(s:string,length:number,words:number)=>{if(typeof s!=='string'||!s.trim()||s.length>length||s.trim().split(/\s+/).length>words||/[\r\n<>]/.test(s))throw Error('O mapa contém texto longo ou inválido.');};
 label(value.map?.title,64,8);
 if(!Array.isArray(value.map.themes)||!value.map.themes.length||value.map.themes.length>8)throw Error('Mapa com temas inválidos.');
 if(!hasExplanations(value))throw Error('Este mapa ainda não contém explicações. Reinicie o backend atualizado e gere o novo mapa.');
 for(const theme of value.map.themes){label(theme.label,48,5);if(!Array.isArray(theme.topics)||!theme.topics.length||theme.topics.length>5)throw Error('Tema com tópicos inválidos.');for(const topic of theme.topics){label(topic.label,42,6);label(topic.brief,100,18);label(topic.explanation,360,65);if(!Array.isArray(topic.references)||!topic.references.length||topic.references.length>6||topic.references.some(r=>!r||typeof r.documentId!=='string'||!Number.isInteger(r.page)||r.page<1))throw Error('Fonte inválida no mapa.');}}
 return value;
}
const palette=['#2563EB','#6366F1','#0369A1','#7C3AED','#3B5BDB','#1D4ED8','#4F46E5','#0E7490'];
export type MapNode={label:string;brief?:string;explanation?:string;themeIndex?:number;topicIndex?:number;x:number;y:number;width:number;height:number;color:string;kind:'root'|'theme'|'topic'};
export type MapEdge={x1:number;y1:number;x2:number;y2:number;color:string};
function wrap(s:string,max:number){const pieces=s.split(/\s+/).flatMap(w=>w.length>max?w.match(new RegExp('.{1,'+max+'}','g'))||[w]:[w]);const lines:string[]=[];let line='';for(const word of pieces){if(line&&line.length+word.length+1>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
export function mapLayout(map:MindMap){
 const heights=map.themes.map(t=>t.topics.map(p=>Math.max(100,30+wrap(p.label,29).length*18+wrap(p.brief,34).length*17)));
 const spans=heights.map(items=>items.reduce((sum,h)=>sum+h+18,0)+36),totals=[0,0];spans.forEach((n,i)=>totals[i%2]+=n);
 const width=1540,height=Math.max(420,...totals.map(n=>n+90)),center=height/2;
 const nodes:MapNode[]=[{label:map.title,x:660,y:center-52,width:220,height:104,color:'#2563EB',kind:'root'}],edges:MapEdge[]=[];
 const offsets=[(height-totals[0])/2,(height-totals[1])/2];
 map.themes.forEach((theme,i)=>{
  const side=i%2,cy=offsets[side]+spans[i]/2,color=palette[i%palette.length],x=side===0?350:1010;
  nodes.push({label:theme.label,x,y:cy-36,width:180,height:72,color,kind:'theme'});
  edges.push({x1:side===0?660:880,y1:center,x2:side===0?530:1010,y2:cy,color});
  let top=offsets[side]+18;
  theme.topics.forEach((topic,j)=>{const h=heights[i][j],ty=top+h/2;
   nodes.push({label:topic.label,brief:topic.brief,explanation:topic.explanation,themeIndex:i,topicIndex:j,x:side===0?28:1242,y:top,width:270,height:h,color,kind:'topic'});
   edges.push({x1:side===0?350:1190,y1:cy,x2:side===0?298:1242,y2:ty,color});top+=h+18;
  });offsets[side]+=spans[i];
 });return {width,height,nodes,edges};
}
function xml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
export function mindMapSvg(map:MindMap):string{
 const layout=mapLayout(map);
 const edges=layout.edges.map(e=>{const mid=(e.x1+e.x2)/2;return `<path d="M${e.x1} ${e.y1} C${mid} ${e.y1} ${mid} ${e.y2} ${e.x2} ${e.y2}" fill="none" stroke="${e.color}" stroke-width="2" opacity=".55"/>`;}).join('');
 const nodes=layout.nodes.map(n=>{const root=n.kind==='root',topic=n.kind==='topic',lines=wrap(n.label,n.kind==='theme'?19:topic?29:26),lineHeight=root?20:18;const y=topic?n.y+26:n.y+n.height/2-(lines.length-1)*lineHeight/2+5;
  const brief=topic?wrap(n.brief||'',34).map((line,i)=>`<tspan x="${n.x+16}" y="${y+lines.length*18+9+i*17}">${xml(line)}</tspan>`).join(''):'';
  return `<g><title>${xml(n.explanation||n.label)}</title><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${root?23:15}" fill="${root?n.color:'#FFFFFF'}" stroke="${n.color}" stroke-width="${n.kind==='theme'?1.8:1}"/><text font-family="Arial,Helvetica,sans-serif" font-size="${root?17:14}" font-weight="600" fill="${root?'#FFFFFF':'#142440'}" text-anchor="${topic?'start':'middle'}">${lines.map((line,i)=>`<tspan x="${topic?n.x+16:n.x+n.width/2}" y="${y+i*lineHeight}">${xml(line)}</tspan>`).join('')}</text>${brief?`<text font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#53627A">${brief}</text>`:''}</g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${xml(map.title)}</title><rect width="100%" height="100%" fill="#F5F7FC"/><text x="32" y="25" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#73819A">Cola.ai · Mapa mental</text>${edges}${nodes}<text x="32" y="${layout.height-14}" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#73819A">Conceitos e explicações baseados no resumo salvo</text></svg>`;
}
