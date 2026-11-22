import { useEffect,useRef,useState,type ComponentRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { Screen } from '../ui/Screen';
import { colors } from '../ui/theme';
import { listLibrary,readCorpus,shortCourse,type LibraryEntry } from '../library/local';
import { selection } from '../library/catalog';
import { ApiError,connection,request } from '../study/api';
import { mapLayout,mindMapSvg,validateMap,type MindMapResult } from '../mindmap/model';
import { readMap,saveMap,shareMap } from '../mindmap/storage';
export default function MapPage(){
 const {source,courseKey}=useLocalSearchParams<{source?:string;courseKey?:string}>();
 const [entry,setEntry]=useState<LibraryEntry|null>(null),[map,setMap]=useState<MindMapResult|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[zoom,setZoom]=useState<number|null>(null),[details,setDetails]=useState(false);
 const control=useRef<AbortController|null>(null),horizontal=useRef<ComponentRef<typeof ScrollView>>(null),vertical=useRef<ComponentRef<typeof ScrollView>>(null);
 const {width}=useWindowDimensions();
 useEffect(()=>{let alive=true;void(async()=>{try{
  const entries=await listLibrary(),latest=await readCorpus(),chosen=selection(entries,source,courseKey,latest?.course.url);
  if(!chosen?.study?.course||!chosen.study.result)throw Error('Abra uma disciplina com resumo geral pronto para gerar seu mapa.');
  const cached=await readMap(chosen.study.course.key,chosen.study.result.createdAt);
  if(alive){setEntry(chosen);setMap(cached);}
 }catch(e){if(alive)setError((e as Error).message);}finally{if(alive)setReady(true);}})();return()=>{alive=false;control.current?.abort();};},[source,courseKey]);
 async function generate(){
  if(control.current||!entry?.study?.course||!entry.study.result)return;
  const c=new AbortController();control.current=c;setBusy(true);setError('');setStatus('Organizando temas e tópicos…');
  try{
   const raw=await SecureStore.getItemAsync('cola-ai-mac-connection');if(!raw)throw Error('Configure a conexão ao Mac pela engrenagem da revisão.');
   const parsed=JSON.parse(raw),config=connection(parsed.url,parsed.token),key=entry.study.course.key;
   let result:MindMapResult;
   try{result=await request<MindMapResult>(config,`/courses/${key}/mind-map`,'GET',undefined,c.signal);}catch(e){if(!(e instanceof ApiError&&e.status===404))throw e;result=await request<MindMapResult>(config,`/courses/${key}/mind-map`,'POST',undefined,c.signal,240000);}
   validateMap(result,key,entry.study.result.createdAt);await saveMap(result);setMap(result);setStatus('Mapa salvo no iPhone.');
  }catch(e){setError(c.signal.aborted?'Geração interrompida.':(e as Error).message);}finally{control.current=null;setBusy(false);}
 }
 const layout=map?mapLayout(map.map):null,fit=layout?Math.min(1,(width-32)/layout.width):1,scale=zoom||fit;
 function resize(value:number){setZoom(Math.max(fit,Math.min(1.5,value)));horizontal.current?.scrollTo({x:0,animated:false});vertical.current?.scrollTo({y:0,animated:false});}
 return <Screen back title="Mapa mental">
  <ScrollView contentContainerStyle={styles.content}>
   <Text style={styles.eyebrow}>TEMAS, CONCEITOS E CONEXÕES</Text><Text style={styles.title}>{entry?shortCourse(entry.title):'Sua revisão visual'}</Text>
   <Text style={styles.note}>Uma visão geral em tópicos curtos, separada do PDF do resumo.</Text>
   {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
   {!ready&&<ActivityIndicator color={colors.blue}/>}
   {!map&&entry&&<View style={styles.card}><Text style={styles.subtitle}>Menos texto. Mais conexões.</Text><Text style={styles.note}>O mapa usa o resumo já gerado para organizar os temas. Na primeira vez, conecte ao Mac para gerar; depois, ele fica salvo para consultar offline.</Text>
    <Pressable disabled={busy} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void generate()}><Text style={styles.primaryText}>{busy?'Gerando mapa…':'Gerar mapa mental'}</Text></Pressable>
    {busy&&<><ActivityIndicator color={colors.blue}/><Text accessibilityLiveRegion="polite" style={styles.note}>{status}</Text><Pressable style={styles.secondary} onPress={()=>control.current?.abort()}><Text style={styles.link}>Cancelar</Text></Pressable></>}
   </View>}
   {map&&layout&&<>
    <View style={styles.tools}><Pressable accessibilityLabel="Diminuir mapa" style={styles.tool} onPress={()=>resize(scale/1.4)}><Text style={styles.link}>−</Text></Pressable><Pressable style={styles.tool} onPress={()=>resize(fit)}><Text style={styles.link}>Visão geral</Text></Pressable><Pressable accessibilityLabel="Ampliar mapa" style={styles.tool} onPress={()=>resize(scale*1.4)}><Text style={styles.link}>+</Text></Pressable></View>
    <Text style={styles.hint}>Amplie e arraste para explorar os ramos.</Text>
    <View style={[styles.canvas,{height:Math.min(460,layout.height*scale+2)}]}><ScrollView ref={vertical} nestedScrollEnabled maximumZoomScale={1} style={{flex:1}}><ScrollView ref={horizontal} horizontal nestedScrollEnabled style={{height:layout.height*scale}}><View style={{width:layout.width*scale,height:layout.height*scale}}><SvgXml xml={mindMapSvg(map.map)} width={layout.width*scale} height={layout.height*scale} accessibilityLabel={'Mapa mental de '+map.map.title}/></View></ScrollView></ScrollView></View>
    <Pressable style={styles.secondary} onPress={()=>{setError('');void shareMap(map).catch(e=>setError(e.message));}}><Text style={styles.link}>Salvar mapa separado (SVG)</Text></Pressable>
    <Pressable style={styles.secondary} onPress={()=>setDetails(!details)}><Text style={styles.link}>{details?'Ocultar tópicos e fontes':'Ver tópicos e fontes'}</Text></Pressable>
    {details&&map.map.themes.map((theme,i)=><View key={i} style={styles.card}><Text style={styles.subtitle}>{theme.label}</Text>{theme.topics.map((topic,j)=><View key={j} style={{gap:5}}><Text style={styles.topic}>{topic.label}</Text>{topic.references.map((r,n)=><Text key={n} style={styles.hint}>{entry?.study?.course?.documents.find(d=>d.id===r.documentId)?.name||r.documentId} · página {r.page}</Text>)}</View>)}</View>)}
    <Text style={styles.hint}>O mapa simplifica o resumo para revisão. Consulte a revisão completa para explicações e detalhes.</Text>
   </>}
  </ScrollView>
 </Screen>;
}
const styles=StyleSheet.create({content:{padding:20,gap:18,paddingBottom:45},eyebrow:{fontSize:9,letterSpacing:1.5,fontWeight:'700',color:colors.blue},title:{fontSize:27,lineHeight:34,fontWeight:'700',letterSpacing:-.8,color:colors.ink},note:{fontSize:14,lineHeight:23,color:colors.muted},card:{padding:22,borderRadius:24,backgroundColor:'white',gap:18},subtitle:{fontSize:19,fontWeight:'600',color:colors.ink},primary:{padding:17,borderRadius:17,backgroundColor:colors.blue,alignItems:'center'},primaryText:{color:'white',fontWeight:'600'},secondary:{padding:16,borderRadius:16,backgroundColor:colors.paleBlue,alignItems:'center'},link:{fontSize:14,fontWeight:'600',color:colors.blue},error:{padding:16,borderRadius:16,backgroundColor:'#FFF0F1',color:colors.red,lineHeight:22},disabled:{opacity:.45},tools:{flexDirection:'row',gap:10,justifyContent:'center'},tool:{paddingHorizontal:17,paddingVertical:12,borderRadius:14,backgroundColor:'white',minWidth:44,alignItems:'center'},hint:{fontSize:11,lineHeight:18,color:colors.muted},canvas:{borderWidth:1,borderColor:colors.line,borderRadius:22,overflow:'hidden',backgroundColor:colors.background},topic:{fontSize:14,fontWeight:'500',color:colors.ink}});
