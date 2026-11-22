import { useEffect,useRef,useState,type ComponentRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { Screen } from '../ui/Screen';
import { colors } from '../ui/theme';
import { listLibrary,readCorpus,shortCourse,type LibraryEntry } from '../library/local';
import { selection } from '../library/catalog';
import { ApiError,connection,request } from '../study/api';
import { mapLayout,mindMapSvg,validateMap,type MindMapResult,type MindMapTopic } from '../mindmap/model';
import { readMap,saveMap,shareMap } from '../mindmap/storage';
export default function MapPage(){
 const {source,courseKey}=useLocalSearchParams<{source?:string;courseKey?:string}>();
 const [entry,setEntry]=useState<LibraryEntry|null>(null),[map,setMap]=useState<MindMapResult|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[zoom,setZoom]=useState<number|null>(null),[details,setDetails]=useState(false);
 const control=useRef<AbortController|null>(null),horizontal=useRef<ComponentRef<typeof ScrollView>>(null),vertical=useRef<ComponentRef<typeof ScrollView>>(null);
 const {width}=useWindowDimensions();
 const [selected,setSelected]=useState<{theme:string;topic:MindMapTopic}|null>(null);
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
   <Text style={styles.note}>Conceitos com explicações breves. Toque em um tópico para entender o que é, para que serve e consultar a fonte.</Text>
   {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
   {!ready&&<ActivityIndicator color={colors.blue}/>}
   {!map&&entry&&<View style={styles.card}><Text style={styles.subtitle}>Conceitos que fazem sentido.</Text><Text style={styles.note}>O mapa usa o resumo já gerado para explicar os temas. Mapas antigos precisam ser gerados novamente para incluir explicações. Na primeira vez, conecte ao Mac para gerar; depois, ele fica salvo para consultar offline.</Text>
    <Pressable disabled={busy} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void generate()}><Text style={styles.primaryText}>{busy?'Gerando mapa…':'Gerar mapa mental'}</Text></Pressable>
    {busy&&<><ActivityIndicator color={colors.blue}/><Text accessibilityLiveRegion="polite" style={styles.note}>{status}</Text><Pressable style={styles.secondary} onPress={()=>control.current?.abort()}><Text style={styles.link}>Cancelar</Text></Pressable></>}
   </View>}
   {map&&layout&&<>
    <View style={styles.tools}><Pressable accessibilityLabel="Diminuir mapa" style={styles.tool} onPress={()=>resize(scale/1.4)}><Text style={styles.link}>−</Text></Pressable><Pressable style={styles.tool} onPress={()=>resize(fit)}><Text style={styles.link}>Visão geral</Text></Pressable><Pressable accessibilityLabel="Ampliar mapa" style={styles.tool} onPress={()=>resize(scale*1.4)}><Text style={styles.link}>+</Text></Pressable></View>
    <Text style={styles.hint}>Amplie e arraste. Toque nos tópicos para abrir a explicação e as fontes.</Text>
    <View style={[styles.canvas,{height:Math.min(460,layout.height*scale+2)}]}><ScrollView ref={vertical} nestedScrollEnabled maximumZoomScale={1} style={{flex:1}}><ScrollView ref={horizontal} horizontal nestedScrollEnabled style={{height:layout.height*scale}}><View style={{width:layout.width*scale,height:layout.height*scale}}><SvgXml xml={mindMapSvg(map.map)} width={layout.width*scale} height={layout.height*scale} accessibilityLabel={'Mapa mental de '+map.map.title}/>{layout.nodes.filter(n=>n.kind==='topic').map(n=><Pressable key={`${n.themeIndex}-${n.topicIndex}`} accessibilityRole="button" accessibilityLabel={`${n.label}. ${n.brief}. Abrir explicação e fontes`} onPress={()=>setSelected({theme:map.map.themes[n.themeIndex!].label,topic:map.map.themes[n.themeIndex!].topics[n.topicIndex!]})} style={{position:'absolute',left:n.x*scale,top:n.y*scale,width:n.width*scale,height:n.height*scale,borderRadius:15*scale}}/>)}</View></ScrollView></ScrollView></View>
    <Pressable style={styles.secondary} onPress={()=>{setError('');void shareMap(map).catch(e=>setError(e.message));}}><Text style={styles.link}>Salvar mapa separado (SVG)</Text></Pressable>
    <Pressable style={styles.secondary} onPress={()=>setDetails(!details)}><Text style={styles.link}>{details?'Ocultar tópicos e fontes':'Ver tópicos e fontes'}</Text></Pressable>
    {details&&map.map.themes.map((theme,i)=><View key={i} style={styles.card}><Text style={styles.subtitle}>{theme.label}</Text>{theme.topics.map((topic,j)=><Pressable key={j} accessibilityRole="button" accessibilityLabel={topic.label+'. Abrir explicação e fontes'} onPress={()=>setSelected({theme:theme.label,topic})} style={{gap:5,paddingVertical:8}}><Text style={styles.topic}>{topic.label}</Text><Text style={styles.note}>{topic.brief}</Text>{topic.references.map((r,n)=><Text key={n} style={styles.hint}>{entry?.study?.course?.documents.find(d=>d.id===r.documentId)?.name||r.documentId} · página {r.page}</Text>)}</Pressable>)}</View>)}
    <Text style={styles.hint}>As explicações vêm do resumo salvo. Consulte a revisão completa para aprofundar o conteúdo.</Text>
   </>}
  </ScrollView>
  <Modal visible={!!selected} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
   <View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Fechar explicação" onPress={()=>setSelected(null)}/><View style={styles.sheet} accessibilityViewIsModal>
    <View style={styles.sheetHeader}><Text style={[styles.eyebrow,{flex:1}]}>{selected?.theme}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar explicação" style={styles.tool} onPress={()=>setSelected(null)}><Text style={styles.link}>Fechar</Text></Pressable></View>
    <ScrollView contentContainerStyle={{gap:18,paddingBottom:20}}><Text style={styles.subtitle}>{selected?.topic.label}</Text><Text style={styles.note}>{selected?.topic.brief}</Text><Text style={styles.explanation}>{selected?.topic.explanation}</Text><Text style={styles.eyebrow}>FONTES DO MATERIAL</Text>{selected?.topic.references.map((r,n)=><Text key={n} style={styles.hint}>{entry?.study?.course?.documents.find(d=>d.id===r.documentId)?.name||r.documentId} · página {r.page}</Text>)}</ScrollView>
   </View></View>
  </Modal>
 </Screen>;
}
const styles=StyleSheet.create({modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(20,36,64,.4)'},sheet:{backgroundColor:'white',borderTopLeftRadius:28,borderTopRightRadius:28,padding:24,paddingBottom:35,maxHeight:'80%'},sheetHeader:{flexDirection:'row',alignItems:'center',gap:15,marginBottom:18},explanation:{fontSize:17,lineHeight:28,color:colors.ink},content:{padding:20,gap:18,paddingBottom:45},eyebrow:{fontSize:9,letterSpacing:1.5,fontWeight:'700',color:colors.blue},title:{fontSize:27,lineHeight:34,fontWeight:'700',letterSpacing:-.8,color:colors.ink},note:{fontSize:14,lineHeight:23,color:colors.muted},card:{padding:22,borderRadius:24,backgroundColor:'white',gap:18},subtitle:{fontSize:19,fontWeight:'600',color:colors.ink},primary:{padding:17,borderRadius:17,backgroundColor:colors.blue,alignItems:'center'},primaryText:{color:'white',fontWeight:'600'},secondary:{padding:16,borderRadius:16,backgroundColor:colors.paleBlue,alignItems:'center'},link:{fontSize:14,fontWeight:'600',color:colors.blue},error:{padding:16,borderRadius:16,backgroundColor:'#FFF0F1',color:colors.red,lineHeight:22},disabled:{opacity:.45},tools:{flexDirection:'row',gap:10,justifyContent:'center'},tool:{paddingHorizontal:17,paddingVertical:12,borderRadius:14,backgroundColor:'white',minWidth:44,alignItems:'center'},hint:{fontSize:11,lineHeight:18,color:colors.muted},canvas:{borderWidth:1,borderColor:colors.line,borderRadius:22,overflow:'hidden',backgroundColor:colors.background},topic:{fontSize:14,fontWeight:'500',color:colors.ink}});
