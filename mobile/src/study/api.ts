export type Connection={url:string;token:string};
export type Citation={documentId:string;page:number};
export type Summary={summary:{title:string;sections:{title:string;text:string;references:Citation[]}[]};model:string;createdAt:string;warnings:string[];documentCount:number;pageCount:number;supplementedDocuments:number};
export type CourseInfo={key:string;sourceUrl?:string;title:string;fingerprint:string;documents:{id:string;name:string;pages:number}[];documentCount:number;pageCount:number;characterCount:number;coverage:string;warnings:string[];cachedDocuments:number;summary:Summary|null};
export type Job={id:string;courseKey:string;state:'queued'|'running'|'completed'|'failed'|'cancelled';progress:string;error:string|null;result:Summary|null;documents:{id:string;name:string}[]};
export function connection(url:string,token:string):Connection{
 let u:URL;try{u=new URL(url.trim())}catch{throw Error('Informe o endereço exibido no Mac, incluindo http:// e a porta.');}
 const octets=u.hostname.split('.').map(Number);
 const privateIp=octets.length===4&&octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(octets[0]===10||octets[0]===172&&octets[1]>=16&&octets[1]<=31||octets[0]===192&&octets[1]===168);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(u.protocol!=='https:'&&!(u.protocol==='http:'&&privateIp)))throw Error('Use o endereço privado do Mac na rede Wi-Fi, ou um servidor HTTPS.');
 if(!/^[a-f0-9]{64}$/.test(token.trim()))throw Error('Cole o código de 64 caracteres exibido em /mobile-setup no Mac. Não é a chave Gemini.');
 return {url:u.origin,token:token.trim()};
}
export class ApiError extends Error { constructor(message:string,public status:number){super(message);} }
export async function request<T>(config:Connection,path:string,method='GET',body?:string,signal?:AbortSignal):Promise<T>{
 const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,30000);
 try{
  if(signal?.aborted)throw Error('Operação interrompida.');
  const response=await fetch(config.url+'/api/mobile'+path,{method,headers:{Authorization:'Bearer '+config.token,...(body?{'Content-Type':'application/json'}:{})},body,signal:controller.signal,credentials:'omit',redirect:'error'});
  if(response.status===401)throw Error('Código de acesso incorreto. Confira /mobile-setup no Mac.');
  if(response.status===404)throw new ApiError('Servidor ou processamento não encontrado. Verifique se o modo mobile está ativo.',404);
  const contentType=response.headers.get('content-type')||'';
  const raw=await response.text();
  if(!contentType.toLowerCase().includes('json')||raw.trimStart().startsWith('<')){
   throw new ApiError(`O endereço respondeu com uma página, não com a API do Cola.ai (HTTP ${response.status}, porta ${new URL(config.url).port||'padrão'}). Use o endereço do Mac exibido em /mobile-setup, normalmente na porta 5180, e não o endereço do Expo (8081).`,response.status);
  }
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new ApiError(`A API retornou JSON inválido (HTTP ${response.status}). Confira o Terminal do backend.`,response.status);}

  if(!response.ok)throw Error(value&&typeof value==='object'&&'error' in value&&typeof value.error==='string'?value.error:'O servidor recusou a operação.');
  return value as T;
 }catch(e){
  if(e instanceof TypeError)throw Error('Não foi possível conectar ao Mac. Confira Wi-Fi, endereço, servidor ativo e acesso à rede local.');
  if(controller.signal.aborted)throw Error('Conexão interrompida ou tempo de espera excedido. A geração no Mac pode continuar; use Atualizar andamento.');
  throw e;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
