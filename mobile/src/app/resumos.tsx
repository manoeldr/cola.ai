import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../ui/Screen';
import { Icon } from '../ui/Icon';
import { colors } from '../ui/theme';
import * as SecureStore from 'expo-secure-store';
import { listLibrary,readCorpus,saveStudy,shortCourse } from '../library/local';
import { selection } from '../library/catalog';
import { ApiError, connection, request, type Connection, type CourseInfo, type Job, type Summary } from '../study/api';
const CONFIG_KEY='cola-ai-mac-connection';
type Saved={course:CourseInfo|null;job:Job|null;result:Summary|null;sourceUrl?:string};
export default function Resumos(){
 const {settings,source,courseKey}=useLocalSearchParams<{settings?:string;source?:string;courseKey?:string}>();
 const [selectedSource,setSelectedSource]=useState<string|undefined>(),[selectedTitle,setSelectedTitle]=useState(''),[loadedFor,setLoadedFor]=useState('');
 const selectionKey=source||courseKey||'latest';
 const [showSettings,setShowSettings]=useState(settings==='1'),[showCoverage,setShowCoverage]=useState(false);
 const [url,setUrl]=useState(''),[token,setToken]=useState(''),[config,setConfig]=useState<Connection|null>(null);
 const [course,setCourse]=useState<CourseInfo|null>(null),[job,setJob]=useState<Job|null>(null),[result,setResult]=useState<Summary|null>(null);
 const [status,setStatus]=useState('Conecte ao Mac para enviar o acervo e gerar seu resumo.'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[configured,setConfigured]=useState<boolean|null>(null);
 const requestControl=useRef<AbortController|null>(null);
 const savedRef=useRef<Saved>({course:null,job:null,result:null});
 const save=async(value:Saved)=>{savedRef.current={...value,sourceUrl:value.sourceUrl||selectedSource};await saveStudy({...value,sourceUrl:value.sourceUrl||selectedSource});};
 useEffect(()=>{let alive=true;void(async()=>{try{
  const raw=await SecureStore.getItemAsync(CONFIG_KEY);if(raw&&alive){const c=connection(JSON.parse(raw).url,JSON.parse(raw).token);setUrl(c.url);setToken(c.token);setConfig(c);}
  const entries=await listLibrary(),latest=await readCorpus();
  const entry=selection(entries,source,courseKey,latest?.course.url);
  if(alive){
   const s=entry?.study;
   savedRef.current=s||{course:null,job:null,result:null};
   setSelectedSource(entry?.sourceUrl||source);setSelectedTitle(entry?.title||'');
   setCourse(s?.course||null);setJob(s?.job||null);setResult(s?.result||null);setLoadedFor(selectionKey);
   if((source||courseKey)&&!entry)setError('Esta disciplina não está salva no iPhone. Atualize a biblioteca pelo Mac ou importe seus materiais.');
  }
 }catch{if(alive){setError('Não foi possível restaurar a conexão ou o resumo salvo.');setLoadedFor(selectionKey);}}finally{if(alive)setReady(true);}})();return()=>{alive=false;requestControl.current?.abort();};},[source,courseKey,selectionKey]);
 async function perform(action:(signal:AbortSignal)=>Promise<void>){
  if(requestControl.current)return;
  const control=new AbortController();requestControl.current=control;setBusy(true);setError('');
  try{await action(control.signal);}catch(e){setError((e as Error).message);}finally{requestControl.current=null;setBusy(false);}
 }
 async function connect(signal:AbortSignal){
  const c=connection(url,token);
  const health=await request<{service:string;geminiConfigured:boolean;model:string}>(c,'/health','GET',undefined,signal);
  if(health.service!=='cola-ai-mobile')throw Error('O endereço não corresponde ao Cola.ai.');
  if(config&&config.url!==c.url){setCourse(null);setJob(null);setResult(null);await save({course:null,job:null,result:null});}
  await SecureStore.setItemAsync(CONFIG_KEY,JSON.stringify(c));setConfig(c);setConfigured(health.geminiConfigured);
  setStatus(`Mac conectado · ${health.model}. ${health.geminiConfigured?'Gemini configurado.':'Configure o Gemini no Terminal do Mac para gerar novos resumos.'}`);
 }
 async function upload(signal:AbortSignal){
  if(!config)throw Error('Conecte ao Mac primeiro.');
  if(!selectedSource)throw Error('Importe os materiais desta disciplina pelo Blackboard primeiro.');
  const data=await readCorpus(selectedSource);if(!data)throw Error('Os materiais desta disciplina não estão salvos neste iPhone. Importe-os pelo Blackboard.');
  const raw=JSON.stringify(data);
  if(data.source!=='blackboard-batch'||!Array.isArray(data.files))throw Error('O acervo salvo não é válido.');
  if(!data.processingComplete)throw Error('Há materiais pendentes no acervo. Retome a importação antes de enviar para o resumo geral.');
  setStatus('Enviando e indexando o acervo no Mac…');
  const c=await request<CourseInfo>(config,'/courses/import','POST',raw,signal);
  setCourse(c);setJob(null);setResult(c.summary);await save({course:c,job:null,result:c.summary});
  setStatus(`${c.documentCount} materiais e ${c.pageCount} páginas no Mac. ${c.cachedDocuments} resumos individuais já salvos.`);
  return c;
 }
 async function generate(signal:AbortSignal,target:CourseInfo|null=course){
  if(!config||!target)throw Error('Envie o acervo ao Mac primeiro.');
  setStatus('Verificando o Gemini no Mac…');
  const health=await request<{geminiConfigured:boolean}>(config,'/health','GET',undefined,signal);
  setConfigured(health.geminiConfigured);
  if(!health.geminiConfigured&&!target.summary){
   setStatus('A geração não foi iniciada.');
   throw Error('Falta configurar a chave Gemini e a confirmação do nível gratuito no Terminal do backend. Reinicie o backend nesse mesmo Terminal e tente novamente.');
  }
  setStatus('Solicitando a geração do resumo ao Mac…');
  const j=await request<Job>(config,`/courses/${encodeURIComponent(target.key)}/summary`,'POST',undefined,signal);
  setJob(j);setResult(null);setStatus(j.progress);await save({course:target,job:j,result:null});
 }
 async function prepare(signal:AbortSignal){const target=await upload(signal);if(target.summary){setStatus('Resumo salvo atualizado.');return;}await generate(signal,target);}
 async function refresh(signal?:AbortSignal){
  if(!config||!job)return;
  let j:Job;
  try{j=await request<Job>(config,`/jobs/${encodeURIComponent(job.id)}`,'GET',undefined,signal);}
  catch(e){if(e instanceof ApiError&&e.status===404){
   const failed:Job={...job,state:'failed',error:'O processamento não está mais no Mac. Toque em Gerar ou retomar resumo geral para continuar com os resumos salvos.'};
   setJob(failed);setError(failed.error!);await save({course,job:failed,result});return;
  }throw e;}

  setJob(j);setStatus(j.progress);if(j.error)setError(j.error);
  if(j.result){setResult(j.result);await save({course,job:j,result:j.result});}
  else if(j.state!=='running'&&j.state!=='queued')await save({course,job:j,result:null});
 }
 useEffect(()=>{
  if(!ready||!config||!job||!['queued','running'].includes(job.state))return;
  const control=new AbortController();let active=true,inFlight=false;
  const tick=async()=>{if(!active||inFlight||AppState.currentState!=='active'||requestControl.current)return;inFlight=true;try{await refresh(control.signal);}catch(e){if(active){setError((e as Error).message);active=false;}}finally{inFlight=false;}};
  const timer=setInterval(()=>{if(active)void tick();},2500);
  return()=>{active=false;clearInterval(timer);control.abort();};
  // Refresh uses the current connection, course and job snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,config,job?.id,job?.state,course]);
 if(!ready||loadedFor!==selectionKey)return <Screen back title="Sua revisão"><ActivityIndicator color={colors.blue}/></Screen>;
 const generating=job?.state==='queued'||job?.state==='running';
 const docs=job?.result?job.documents:course?.documents||[];
 return <Screen back title="Sua revisão" action={<Pressable accessibilityLabel="Configurações da revisão" style={styles.settingsButton} onPress={()=>setShowSettings(!showSettings)}><Icon name="settings" size={21} color={colors.muted}/></Pressable>}>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
   {showSettings||ready&&!config?<View style={styles.card}>
    <Text style={styles.subtitle}>Conectar ao Mac</Text>
    <Text style={styles.note}>Abra http://127.0.0.1:5180/mobile-setup no Mac e copie o endereço e o código de acesso.</Text>
    <TextInput accessibilityLabel="Endereço do Mac" placeholder="http://192.168.1.10:5180" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} editable={!busy&&!generating}/>
    <TextInput accessibilityLabel="Código de acesso ao Mac" placeholder="Código de acesso do Mac" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.input} editable={!busy&&!generating}/>
    <Pressable disabled={busy||generating||!ready} style={[styles.primary,(busy||generating)&&styles.disabled]} onPress={()=>void perform(async signal=>{await connect(signal);setShowSettings(false);})}><Text style={styles.primaryText}>Conectar</Text></Pressable>
   </View>:null}
   <View style={styles.intro}>
    {result&&!!selectedTitle&&<Text style={styles.note}>{shortCourse(selectedTitle)}</Text>}
    <Text style={styles.eyebrow}>{result?'REVISÃO SALVA':'DO MATERIAL À CLAREZA'}</Text>
    <Text style={styles.title}>{result?result.summary.title:selectedTitle?shortCourse(selectedTitle):'Sua disciplina,\numa revisão.'}</Text>
    <Text style={styles.note}>{result?`${result.documentCount} materiais · ${result.pageCount} páginas · disponível offline`:'Um resumo dos materiais importados, com fontes para consultar quando precisar.'}</Text>
   </View>
   {(busy||!result)&&<Text accessibilityLiveRegion="polite" style={styles.note}>{status}</Text>}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {busy&&<ActivityIndicator color={colors.blue}/>}
   {configured===false&&!result&&<View style={styles.notice}><Text style={styles.note}>A geração ainda não começou: configure o Gemini no Terminal do Mac. Depois, toque novamente para verificar.</Text></View>}
   {!result&&!generating&&<Pressable disabled={busy||!config||!ready} style={[styles.primary,(busy||!config||!ready)&&styles.disabled]} onPress={()=>void perform(prepare)}><Text style={styles.primaryText}>{busy?'Preparando sua revisão…':'Gerar resumo geral'}</Text><Icon name="arrow" size={18} color="white"/></Pressable>}
   {generating&&<View style={styles.progress}>
    <ActivityIndicator color={colors.blue}/><Text style={styles.subtitle}>Sua revisão está a caminho.</Text><Text accessibilityLiveRegion="polite" style={styles.note}>{job.progress}</Text>
    <Pressable style={styles.secondary} disabled={busy} onPress={()=>void perform(signal=>refresh(signal))}><Text style={styles.link}>Atualizar andamento</Text></Pressable>
    <Pressable style={styles.secondary} disabled={busy} onPress={()=>void perform(async signal=>{if(!config||!job)return;await request(config,`/jobs/${job.id}/cancel`,'POST',undefined,signal);setStatus('Cancelamento solicitado. Resumos concluídos serão preservados.');await refresh(signal);})}><Text style={styles.note}>Cancelar geração</Text></Pressable>
   </View>}
   {result&&result.summary.sections.map((section,i)=><View key={i} style={styles.section}>
    <Text style={styles.sectionNumber}>{String(i+1).padStart(2,'0')}</Text><Text style={styles.sectionTitle}>{section.title}</Text><Text selectable style={styles.body}>{section.text}</Text>
    <View style={styles.references}>{section.references.map((r,n)=><View key={n} style={styles.citationRow}><Icon name="file" size={13} color={colors.blue}/><Text style={styles.citation}>{docs.find(d=>d.id===r.documentId)?.name||r.documentId} · página {r.page}</Text></View>)}</View>
   </View>)}
   {course&&<>
    <Pressable style={styles.metadataButton} onPress={()=>setShowCoverage(!showCoverage)}><Text style={styles.link}>Materiais e cobertura</Text><Icon name="plus" size={16} color={colors.blue}/></Pressable>
    {showCoverage&&<View style={styles.card}><Text style={styles.subtitle}>{course.title}</Text>{course.warnings.map((w,i)=><Text key={i} style={styles.note}>{w}</Text>)}{course.documents.map(d=><Text key={d.id} style={styles.note}>{d.name} · {d.pages} páginas</Text>)}</View>}
   </>}
   {result&&<Pressable disabled={busy||generating||!config} style={[styles.secondary,(busy||generating||!config)&&styles.disabled]} onPress={()=>void perform(prepare)}><Text style={styles.link}>Atualizar resumo com o acervo atual</Text></Pressable>}
   {showSettings&&<>
    <Text style={styles.note}>A geração usa o Mac conectado. Resumos já concluídos são reutilizados, sem nova chamada à IA.</Text>
    <Pressable disabled={busy||generating||!config} style={styles.secondary} onPress={()=>void perform(async signal=>{await upload(signal);})}><Text style={styles.link}>Enviar somente o acervo</Text></Pressable>
   </>}
  </ScrollView>
 </Screen>;
}
const styles=StyleSheet.create({content:{paddingHorizontal:26,paddingTop:14,gap:22,paddingBottom:135},settingsButton:{width:44,height:44,borderRadius:16,backgroundColor:'white',alignItems:'center',justifyContent:'center'},intro:{gap:14,paddingBottom:12},eyebrow:{fontSize:10,letterSpacing:1.7,fontWeight:'700',color:colors.blue},title:{fontSize:30,lineHeight:38,letterSpacing:-1,fontWeight:'700',color:colors.ink},subtitle:{fontSize:18,lineHeight:25,fontWeight:'600',color:colors.ink},card:{padding:22,borderRadius:24,backgroundColor:'white',gap:16},body:{fontSize:16,lineHeight:28,color:'#33435D'},note:{fontSize:13,lineHeight:21,color:colors.muted},input:{borderColor:colors.line,borderWidth:1,padding:15,borderRadius:14,fontSize:15,color:colors.ink,backgroundColor:colors.background},primary:{backgroundColor:colors.blue,padding:18,borderRadius:18,alignItems:'center',flexDirection:'row',justifyContent:'space-between',minHeight:56},primaryText:{color:'white',fontWeight:'600',fontSize:14},secondary:{backgroundColor:colors.paleBlue,padding:16,borderRadius:16,alignItems:'center'},link:{fontSize:13,color:colors.blue,fontWeight:'600'},disabled:{opacity:0.4},error:{color:colors.red,fontSize:14,lineHeight:22,backgroundColor:'#FFF0F1',padding:16,borderRadius:16},section:{gap:14,paddingTop:24,paddingBottom:20,borderTopWidth:1,borderColor:colors.line},sectionNumber:{fontSize:11,letterSpacing:1.4,fontWeight:'700',color:colors.blue},sectionTitle:{fontSize:22,lineHeight:30,fontWeight:'600',color:colors.ink,letterSpacing:-0.5},references:{gap:10,marginTop:5},citationRow:{flexDirection:'row',gap:7,alignItems:'flex-start',paddingLeft:10,borderLeftWidth:2,borderColor:'#CFDCFF'},citation:{fontSize:11,lineHeight:18,color:colors.blue,flex:1},metadataButton:{paddingVertical:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},progress:{backgroundColor:'white',padding:26,borderRadius:24,gap:18,alignItems:'center'},notice:{padding:18,borderRadius:18,backgroundColor:colors.paleBlue}});
