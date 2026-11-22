import { Directory,File,Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { hasExplanations,mindMapSvg,validateMap,type MindMapResult } from './model';
function file(key:string){if(!/^[a-f0-9]{64}$/.test(key))throw Error('Disciplina inválida.');return new File(new Directory(Paths.document,'cola-ai-mapas'),key+'.json');}
export async function readMap(key:string,date:string):Promise<MindMapResult|null>{const f=file(key);if(!f.exists)return null;const result=JSON.parse(await f.text());if(!hasExplanations(result))return null;if(new Date(result.summaryCreatedAt).getTime()!==new Date(date).getTime())return null;return validateMap(result,key,date);}
export async function saveMap(value:MindMapResult){new Directory(Paths.document,'cola-ai-mapas').create({idempotent:true,intermediates:true});await file(value.courseKey).write(JSON.stringify(value));}
export async function shareMap(value:MindMapResult){if(!await Sharing.isAvailableAsync())throw Error('Compartilhamento não disponível.');const f=new File(Paths.cache,'Cola-ai-Mapa-'+value.courseKey.slice(0,10)+'.svg');await f.write(mindMapSvg(value.map));await Sharing.shareAsync(f.uri,{mimeType:'image/svg+xml',UTI:'public.svg-image',dialogTitle:'Salvar mapa mental'});}
