import { useCallback,useState } from 'react';
import { router,useFocusEffect } from 'expo-router';
import { ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Screen } from '../ui/Screen';
import { Icon } from '../ui/Icon';
import { colors } from '../ui/theme';
import { listLibrary,saveStudy,shortCourse,type LibraryEntry } from '../library/local';
import { connection,request,type CourseInfo } from '../study/api';
export default function StudyHome(){
 const [entries,setEntries]=useState<LibraryEntry[]>([]),[error,setError]=useState(''),[syncing,setSyncing]=useState(false);
 useFocusEffect(useCallback(()=>{let alive=true;void listLibrary().then(items=>{if(alive)setEntries(items);}).catch(()=>{if(alive)setError('Não foi possível abrir os materiais salvos.');});return()=>{alive=false;};},[]));
 async function sync(){
  if(syncing)return;setSyncing(true);setError('');
  try{
   const raw=await SecureStore.getItemAsync('cola-ai-mac-connection');if(!raw)throw Error('Configure a conexão ao Mac na engrenagem da tela Foto.');
   const parsed=JSON.parse(raw),config=connection(parsed.url,parsed.token);
   const courses=await request<{key:string;title:string}[]>(config,'/courses');
   for(const course of courses){const info=await request<CourseInfo>(config,'/courses/'+encodeURIComponent(course.key));if(!info.summary)continue;
    const existing=entries.find(e=>e.study?.course?.key===info.key)||entries.find(e=>e.title===info.title);
    await saveStudy({course:info,job:null,result:info.summary,sourceUrl:info.sourceUrl||existing?.sourceUrl});
   }
   setEntries(await listLibrary());
  }catch(e){setError((e as Error).message);}finally{setSyncing(false);}
 }
 return <Screen action={<Pressable accessibilityLabel="Adicionar disciplina" onPress={()=>router.push('/importar')} style={styles.add}><Icon name="plus" color={colors.blue}/></Pressable>}>
  <ScrollView contentContainerStyle={styles.content}>
   <Text style={styles.eyebrow}>SUA BIBLIOTECA</Text><Text style={styles.title}>Cada disciplina,{ '\n' }sua revisão.</Text><Text style={styles.subtitle}>Escolha os materiais ou volte a um resumo salvo.</Text>
   {!!error&&<Text style={styles.error}>{error}</Text>}
   {entries.map(entry=>{
    const imported=entry.corpus?.files.filter(f=>f.status==='concluido')||[];
    const count=entry.corpus?imported.length:entry.study?.course?.documentCount||0;
    const pages=entry.corpus?imported.reduce((n,f)=>n+(f.pageCount||0),0):entry.study?.course?.pageCount||0;
    return <View key={entry.id} style={styles.card}>
     <View style={styles.row}><View style={styles.book}><Icon name="book" size={26} color={colors.blue}/></View><Text style={styles.badge}>{entry.study?.result?'RESUMO SALVO':entry.corpus?.processingComplete?'ACERVO IMPORTADO':'IMPORTAÇÃO PENDENTE'}</Text></View>
     <Text style={styles.courseTitle}>{shortCourse(entry.title)}</Text><Text style={styles.subtitle}>{count} materiais · {pages} páginas</Text>
     <Pressable style={styles.primary} onPress={()=>router.push({pathname:'/resumos',params:entry.sourceUrl?{source:entry.sourceUrl}:{courseKey:entry.study!.course!.key}})}><Text style={styles.primaryText}>{entry.study?.result?'Ler resumo geral':'Preparar resumo geral'}</Text><Icon name="arrow" size={18} color="white"/></Pressable>
     {entry.corpus&&!entry.corpus.processingComplete&&<Text style={styles.small}>Retome a importação no Blackboard antes de gerar o resumo.</Text>}
    </View>;
   })}
   {!entries.length&&<View style={styles.card}><View style={styles.book}><Icon name="book" size={28} color={colors.blue}/></View><Text style={styles.courseTitle}>Seus materiais,{ '\n' }em um só lugar.</Text><Text style={styles.subtitle}>Conecte o Blackboard e importe uma disciplina para começar.</Text><Pressable style={styles.primary} onPress={()=>router.push('/importar')}><Text style={styles.primaryText}>Adicionar disciplina</Text><Icon name="plus" size={18} color="white"/></Pressable></View>}
   <Pressable disabled={syncing} style={styles.link} onPress={()=>void sync()}>{syncing?<ActivityIndicator color={colors.blue}/>:<Text style={styles.linkText}>Buscar resumos salvos no Mac</Text>}</Pressable>
   <Text style={styles.foot}>Os resumos consideram os materiais importados. A cobertura total do Blackboard não é confirmada.</Text>
  </ScrollView>
 </Screen>;
}
const styles=StyleSheet.create({add:{width:44,height:44,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.paleBlue},content:{padding:26,paddingBottom:130,gap:18},eyebrow:{fontSize:10,letterSpacing:2,color:colors.muted,fontWeight:'700'},title:{fontSize:36,lineHeight:42,fontWeight:'700',letterSpacing:-1.2,color:colors.ink},subtitle:{fontSize:14,lineHeight:22,color:colors.muted},card:{backgroundColor:'white',padding:24,borderRadius:26,gap:18,marginTop:12,borderWidth:1,borderColor:colors.line},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},book:{width:56,height:60,backgroundColor:colors.paleBlue,borderRadius:18,alignItems:'center',justifyContent:'center'},badge:{fontSize:8,fontWeight:'700',letterSpacing:1,color:colors.blue},courseTitle:{fontSize:24,lineHeight:31,color:colors.ink,fontWeight:'600',letterSpacing:-0.5},primary:{minHeight:54,paddingHorizontal:18,paddingVertical:16,borderRadius:16,backgroundColor:colors.blue,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryText:{fontSize:14,color:'white',fontWeight:'600'},link:{alignItems:'center',padding:7},linkText:{fontSize:12,color:colors.muted},summaryCard:{backgroundColor:colors.paleBlue,borderRadius:22,padding:20,gap:12,flexDirection:'row',alignItems:'center'},summaryTitle:{fontSize:14,fontWeight:'600',color:colors.ink},small:{fontSize:11,lineHeight:17,color:colors.muted},foot:{fontSize:11,lineHeight:18,color:colors.muted,padding:5},error:{color:colors.red}});
