import { Platform } from 'react-native';
import { Directory,File,Paths } from 'expo-file-system';
import { readCorpus,shortCourse } from '../library/local';
export type LocalPhoto={id:string;createdAt:string;course:string|null};
const folder=()=>new Directory(Paths.document,'cola-ai-photos');
const index=()=>new File(folder(),'index.json');
export function photoUri(id:string):string{if(!/^[0-9]+-[a-z0-9]+$/.test(id))throw Error('Foto inválida.');return new File(folder(),id+'.jpg').uri;}
export async function listPhotos():Promise<LocalPhoto[]>{if(Platform.OS==='web')return [];const file=index();if(!file.exists)return [];const data:unknown=JSON.parse(await file.text());if(!Array.isArray(data))throw Error('Histórico de fotos inválido.');return data.filter(p=>p&&typeof p.id==='string'&&/^[0-9]+-[a-z0-9]+$/.test(p.id)&&typeof p.createdAt==='string');}
export async function savePhoto(uri:string):Promise<LocalPhoto>{
 const photos=await listPhotos();if(photos.length>=100)throw Error('O histórico chegou ao limite de 100 fotos neste dispositivo.');
 folder().create({idempotent:true,intermediates:true});
 const corpus=await readCorpus().catch(()=>null);
 const photo={id:Date.now()+'-'+Math.random().toString(36).slice(2,9),createdAt:new Date().toISOString(),course:corpus?shortCourse(corpus.course.title):null};
 const file=new File(photoUri(photo.id));await new File(uri).copy(file);
 try{await index().write(JSON.stringify([photo,...photos]));}catch(e){if(file.exists)file.delete();throw e;}
 return photo;
}
