import type { Summary } from '../study/api';
export type SummaryDocument={id:string;name:string};
export function escapeHtml(value:string):string{return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function paragraphs(text:string):string {
 return text.trim().split(/\n\s*\n/).filter(Boolean).map(block=>{
  const lines=block.split('\n');
  if(lines.length>1&&lines.every(line=>/^\s*[-•]\s+/.test(line)))return '<ul>'+lines.map(line=>'<li>'+escapeHtml(line.replace(/^\s*[-•]\s+/,''))+'</li>').join('')+'</ul>';
  return '<p>'+escapeHtml(block).replace(/\n/g,'<br>')+'</p>';
 }).join('');
}
export function pdfFilename(course:string):string {
 const name=course.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85)||'disciplina';
 return 'Cola-ai-Resumo-'+name+'.pdf';
}
export function summaryHtml(result:Summary,course:string,documents:SummaryDocument[]):string {
 if(!result.summary.sections.length)throw Error('Este resumo ainda não tem conteúdo para exportar.');
 const names=new Map(documents.map(d=>[d.id,d.name]));
 const date=new Date(result.createdAt).toLocaleDateString('pt-BR');
 const sections=result.summary.sections.map((s,i)=>{
  const seen=new Set<string>();
  const refs=s.references.map(r=>{
   const name=names.get(r.documentId);if(!name)throw Error('Não foi possível identificar uma fonte do resumo. Abra novamente a disciplina antes de exportar.');
   const key=r.documentId+':'+r.page;if(seen.has(key))return '';seen.add(key);
   return '<li>'+escapeHtml(name)+' <span>· página '+r.page+'</span></li>';
  }).join('');
  return `<section><h2><span class="number">${String(i+1).padStart(2,'0')}</span>${escapeHtml(s.title)}</h2>${paragraphs(s.text)}<aside class="citations"><div class="caption">FONTES DESTA SEÇÃO</div><ul>${refs}</ul></aside></section>`;
 }).join('');
 const cited=new Set(result.summary.sections.flatMap(s=>s.references.map(r=>r.documentId)));
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(course)} - Cola.ai</title><style>
 @page{size:A4}*{box-sizing:border-box}body{margin:0;color:#243247;font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.62;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 header{border-top:4pt solid #2563EB;padding-top:18pt;margin-bottom:25pt} .brand{font-family:Arial,Helvetica,sans-serif;font-size:19pt;font-weight:800;letter-spacing:-.7pt;color:#142440}.brand span{color:#2563EB}.kicker{font:700 8pt Arial,Helvetica,sans-serif;letter-spacing:1.6pt;color:#73819A;margin-top:26pt}.course{font:500 11pt/1.5 Arial,Helvetica,sans-serif;color:#52627B;margin:10pt 0 8pt}
 h1{font:700 25pt/1.2 Arial,Helvetica,sans-serif;letter-spacing:-.6pt;color:#142440;margin:0 0 15pt;overflow-wrap:anywhere}.meta{font:9pt/1.6 Arial,Helvetica,sans-serif;color:#73819A;border-top:1pt solid #E6EBF4;padding-top:12pt}
 section{margin-top:25pt}h2{font:700 15pt/1.35 Arial,Helvetica,sans-serif;color:#142440;margin:0 0 12pt;page-break-after:avoid;break-after:avoid;overflow-wrap:anywhere}.number{display:inline-block;color:#2563EB;font-size:9pt;margin-right:9pt;letter-spacing:1pt}p{margin:0 0 10pt;text-align:justify;text-align-last:left;orphans:3;widows:3;overflow-wrap:anywhere}ul{padding-left:17pt;margin:8pt 0 13pt}li{margin-bottom:5pt;orphans:3;widows:3;overflow-wrap:anywhere}
 .citations{margin:14pt 0 3pt;padding:9pt 12pt;border-left:2pt solid #BFCFFF;background:#F5F7FC;font:8.5pt/1.55 Arial,Helvetica,sans-serif;page-break-inside:avoid;break-inside:avoid}.caption{color:#2563EB;font-size:7pt;font-weight:700;letter-spacing:1pt}.citations ul{list-style:none;padding:0;margin:6pt 0 0}.citations li{margin:2pt 0}.citations span{color:#52627B}
 .materials{margin-top:28pt;padding-top:17pt;border-top:1pt solid #CBD6E8}.materials h2{font-size:12pt}.materials ul{font:9pt/1.6 Arial,Helvetica,sans-serif;color:#52627B}.footer{margin-top:20pt;border-top:1pt solid #E6EBF4;padding-top:12pt;font:8pt/1.6 Arial,Helvetica,sans-serif;color:#73819A}.footer p{text-align:left}
 @media screen{body{max-width:665px;margin:40px auto;padding:0 28px}}
 </style></head><body><header><div class="brand">Cola<span>.ai</span></div><div class="kicker">REVISÃO DA DISCIPLINA</div><div class="course">${escapeHtml(course)}</div><h1>${escapeHtml(result.summary.title)}</h1><div class="meta">${result.documentCount} ${result.documentCount===1?'material':'materiais'} · ${result.pageCount} ${result.pageCount===1?'página':'páginas'} de origem<br>Resumo gerado em ${escapeHtml(date)}</div></header>${sections}<div class="materials"><h2>Materiais citados</h2><ul>${documents.filter(d=>cited.has(d.id)).map(d=>'<li>'+escapeHtml(d.name)+'</li>').join('')}</ul></div><footer class="footer"><p>Este resumo considera os materiais importados e preserva as referências da revisão salva. A cobertura total dos conteúdos do Blackboard não foi confirmada.</p><div>Cola.ai · Material de apoio ao estudo</div></footer></body></html>`;
}
