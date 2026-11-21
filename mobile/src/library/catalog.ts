import type { Acervo } from '../importer/protocol';
import type { CourseInfo,Job,Summary } from '../study/api';
export type StudyState={course:CourseInfo|null;job:Job|null;result:Summary|null;sourceUrl?:string};
export type LibraryEntry={id:string;title:string;sourceUrl?:string;corpus:Acervo|null;study:StudyState|null};
export function sourceId(url:string):string{const u=new URL(url);return u.origin+u.pathname.replace(/\/$/,'');}
export function catalog(corpora:Acervo[],studies:StudyState[]):LibraryEntry[]{
 const entries=new Map<string,LibraryEntry>();
 for(const c of corpora){if(!c?.course?.url)continue;const id=sourceId(c.course.url);entries.set(id,{id,title:c.course.title,sourceUrl:id,corpus:c,study:null});}
 for(const s of studies){if(!s?.course?.key)continue;
  const matches=corpora.filter(c=>c.course.title===s.course!.title);
  const source=s.sourceUrl||s.course.sourceUrl||(matches.length===1?matches[0].course.url:undefined);
  const id=source?sourceId(source):s.course.key;
  const existing=entries.get(id);
  entries.set(id,{id,title:s.course.title,sourceUrl:source?sourceId(source):undefined,corpus:existing?.corpus||null,study:s});
 }
 return [...entries.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
}
export function selection(entries:LibraryEntry[],source?:string,key?:string,latestSource?:string):LibraryEntry|null{
 if(source)return entries.find(e=>e.sourceUrl===sourceId(source))||null;
 if(key)return entries.find(e=>e.study?.course?.key===key)||null;
 if(latestSource)return entries.find(e=>e.sourceUrl===sourceId(latestSource))||null;
 return entries[0]||null;
}
