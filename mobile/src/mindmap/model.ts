import type { Citation } from '../study/api';
export type MindMap={title:string;themes:{label:string;topics:{label:string;references:Citation[]}[]}[]};
export type MindMapResult={map:MindMap;courseKey:string;model:string;createdAt:string;summaryCreatedAt:string};
export function validateMap(value:MindMapResult,key:string,summaryDate:string):MindMapResult{
 if(!value||value.courseKey!==key||new Date(value.summaryCreatedAt).getTime()!==new Date(summaryDate).getTime())throw Error('Este mapa pertence a outra versão do resumo. Atualize a revisão da disciplina antes de gerar o mapa.');
 const label=(s:string,length:number,words:number)=>{if(typeof s!=='string'||!s.trim()||s.length>length||s.trim().split(/\s+/).length>words||/[\r\n<>]/.test(s))throw Error('O mapa contém texto longo ou inválido.');};
 label(value.map?.title,64,8);
 if(!Array.isArray(value.map.themes)||!value.map.themes.length||value.map.themes.length>8)throw Error('Mapa com temas inválidos.');
 for(const theme of value.map.themes){label(theme.label,48,5);if(!Array.isArray(theme.topics)||!theme.topics.length||theme.topics.length>5)throw Error('Tema com tópicos inválidos.');for(const topic of theme.topics){label(topic.label,42,6);if(!Array.isArray(topic.references)||!topic.references.length||topic.references.some(r=>!r||typeof r.documentId!=='string'||!Number.isInteger(r.page)||r.page<1))throw Error('Fonte inválida no mapa.');}}
 return value;
}
const palette=['#2563EB','#6366F1','#0369A1','#7C3AED','#3B5BDB','#1D4ED8','#4F46E5','#0E7490'];
export type MapNode={label:string;x:number;y:number;width:number;height:number;color:string;kind:'root'|'theme'|'topic'};
export type MapEdge={x1:number;y1:number;x2:number;y2:number;color:string};
export function mapLayout(map:MindMap){
 const spans=map.themes.map(t=>t.topics.length*76+40),totals=[0,0];spans.forEach((n,i)=>totals[i%2]+=n);
 const width=1380,height=Math.max(420,...totals.map(n=>n+90)),center=height/2;
 const nodes:MapNode[]=[{label:map.title,x:580,y:center-52,width:220,height:104,color:'#2563EB',kind:'root'}],edges:MapEdge[]=[];
 const offsets=[(height-totals[0])/2,(height-totals[1])/2];
 map.themes.forEach((theme,i)=>{
  const side=i%2,cy=offsets[side]+spans[i]/2,color=palette[i%palette.length],x=side===0?320:880;
  nodes.push({label:theme.label,x,y:cy-36,width:180,height:72,color,kind:'theme'});
  edges.push({x1:side===0?580:800,y1:center,x2:side===0?500:880,y2:cy,color});
  theme.topics.forEach((topic,j)=>{const ty=cy+(j-(theme.topics.length-1)/2)*76;
   nodes.push({label:topic.label,x:side===0?32:1128,y:ty-31,width:220,height:62,color,kind:'topic'});
   edges.push({x1:side===0?320:1060,y1:cy,x2:side===0?252:1128,y2:ty,color});
  });offsets[side]+=spans[i];
 });return {width,height,nodes,edges};
}
function xml(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function wrap(s:string,max:number){const pieces=s.split(/\s+/).flatMap(w=>w.length>max?w.match(new RegExp('.{1,'+max+'}','g'))||[w]:[w]);const lines:string[]=[];let line='';for(const word of pieces){if(line&&line.length+word.length+1>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
export function mindMapSvg(map:MindMap):string{
 const layout=mapLayout(map);
 const edges=layout.edges.map(e=>{const mid=(e.x1+e.x2)/2;return `<path d="M${e.x1} ${e.y1} C${mid} ${e.y1} ${mid} ${e.y2} ${e.x2} ${e.y2}" fill="none" stroke="${e.color}" stroke-width="2" opacity=".55"/>`;}).join('');
 const nodes=layout.nodes.map(n=>{const root=n.kind==='root',lines=wrap(n.label,n.kind==='theme'?19:26),lineHeight=root?20:16;const y=n.y+n.height/2-(lines.length-1)*lineHeight/2+5;
  return `<g><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${root?23:15}" fill="${root?n.color:'#FFFFFF'}" stroke="${n.color}" stroke-width="${n.kind==='theme'?1.8:1}"/><text font-family="Arial,Helvetica,sans-serif" font-size="${root?17:n.kind==='theme'?14:13}" font-weight="${n.kind==='topic'?400:600}" fill="${root?'#FFFFFF':'#142440'}" text-anchor="middle">${lines.map((line,i)=>`<tspan x="${n.x+n.width/2}" y="${y+i*lineHeight}">${xml(line)}</tspan>`).join('')}</text></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${xml(map.title)}</title><rect width="100%" height="100%" fill="#F5F7FC"/><text x="32" y="25" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#73819A">Cola.ai · Mapa mental</text>${edges}${nodes}<text x="32" y="${layout.height-14}" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#73819A">Visão geral baseada no resumo salvo</text></svg>`;
}
