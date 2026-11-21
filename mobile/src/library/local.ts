import { Platform } from 'react-native';
import { Directory,File,Paths } from 'expo-file-system';
import type { Acervo } from '../importer/protocol';
import { catalog,sourceId,type LibraryEntry,type StudyState } from './catalog';
export type { StudyState,LibraryEntry } from './catalog';
const summaries=()=>new Directory(Paths.document,'cola-ai-resumos');
const legacy=()=>new File(Paths.document,'cola-ai-study-state.json');
async function readJson<T>(file:File):Promise<T|null>{return file.exists?JSON.parse(await file.text()):null;}
export async function readCorpus(source?:string):Promise<Acervo|null>{
 if(Platform.OS==='web')return null;
 if(source){const items=await listLibrary();return items.find(e=>e.sourceUrl===sourceId(source))?.corpus||null;}
 return readJson<Acervo>(new File(Paths.document,'cola-ai-acervo-disciplina.json'));
}
export async function readStudy():Promise<StudyState|null>{if(Platform.OS==='web')return null;return readJson<StudyState>(legacy());}
export async function listLibrary():Promise<LibraryEntry[]>{
 if(Platform.OS==='web')return [];
 const corpora:Acervo[]=[],studies:StudyState[]=[];
 const folder=new Directory(Paths.document,'cola-ai-acervos');
 if(folder.exists)for(const file of folder.list())if(file instanceof File&&file.name.endsWith('.json')){const c=await readJson<Acervo>(file);if(c?.source==='blackboard-batch')corpora.push(c);}
 const latest=await readJson<Acervo>(new File(Paths.document,'cola-ai-acervo-disciplina.json'));
 if(latest?.course?.url){const i=corpora.findIndex(c=>sourceId(c.course.url)===sourceId(latest.course.url));if(i>=0)corpora[i]=latest;else corpora.push(latest);}
 if(summaries().exists)for(const file of summaries().list())if(file instanceof File&&file.name.endsWith('.json')){const s=await readJson<StudyState>(file);if(s?.course)studies.push(s);}
 const old=await readJson<StudyState>(legacy());
 if(old?.course){const i=studies.findIndex(s=>s.course?.key===old.course!.key);if(i>=0)studies[i]=old;else studies.push(old);}
 return catalog(corpora,studies);
}
async function archive(value:StudyState){if(!value.course)return;if(!/^[a-f0-9]{64}$/.test(value.course.key))throw Error('Identificador da disciplina inválido.');summaries().create({idempotent:true,intermediates:true});await new File(summaries(),value.course.key+'.json').write(JSON.stringify(value));}
export async function saveStudy(value:StudyState){
 // Migrate the previous single-summary file before changing the active course.
 const previous=await readStudy();if(previous?.course)await archive(previous);
 await archive(value);await legacy().write(JSON.stringify(value));
}
export function shortCourse(title:string){return title.replace(/^Conteúdo\s*\/\s*/,'').replace(/\s*-\s*R_.*$/,'');}
