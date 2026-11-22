import { useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { Screen } from '../ui/Screen';
import { colors } from '../ui/theme';
import { connection,request,type Connection } from '../study/api';
import { fingerprint,keyEnvelope,type EncryptionInfo } from '../settings/keyEnvelope';
const CONNECTION='cola-ai-mac-connection',GEMINI='cola-ai-gemini-secret';
type SavedKey={key:string;fingerprint:string};
export default function Settings(){
 const [url,setUrl]=useState(''),[token,setToken]=useState(''),[pin,setPin]=useState(''),[key,setKey]=useState('');
 const [config,setConfig]=useState<Connection|null>(null),[saved,setSaved]=useState<SavedKey|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const control=useRef<AbortController|null>(null);
 useEffect(()=>{let alive=true;void(async()=>{try{
  const [raw,secret]=await Promise.all([SecureStore.getItemAsync(CONNECTION),SecureStore.getItemAsync(GEMINI)]);
  if(!alive)return;
  if(raw){const value=JSON.parse(raw),c=connection(value.url,value.token);setUrl(c.url);setToken(c.token);setConfig(c);}
  if(secret){const value=JSON.parse(secret) as SavedKey;setSaved(value);setPin(value.fingerprint);setConfirmed(true);}
 }catch{if(alive)setError('Não foi possível restaurar as configurações salvas.');}})();return()=>{alive=false;control.current?.abort();};},[]);
 async function perform(fn:(signal:AbortSignal)=>Promise<void>){if(control.current)return;const c=new AbortController();control.current=c;setBusy(true);setError('');try{await fn(c.signal);}catch(e){setError((e as Error).message);}finally{control.current=null;setBusy(false);}}
 async function connect(signal:AbortSignal){const c=connection(url,token);const health=await request<{service:string;geminiConfigured:boolean}>(c,'/health','GET',undefined,signal);if(health.service!=='cola-ai-mobile')throw Error('O endereço não corresponde ao Cola.ai.');await SecureStore.setItemAsync(CONNECTION,JSON.stringify(c));setConfig(c);setStatus(health.geminiConfigured?'Mac conectado. Gemini configurado.':'Mac conectado. Insira ou reaplique a chave Gemini abaixo.');}
 async function apply(signal:AbortSignal){
  if(!confirmed)throw Error('Confirme que a chave pertence a um projeto Gemini no nível gratuito.');
  if(!config)throw Error('Conecte ao Mac primeiro.');
  const c=connection(url,token);if(c.url!==config.url||c.token!==config.token)throw Error('Toque em Conectar para confirmar os novos dados do Mac.');
  const expected=fingerprint(pin),value=key.trim()||(saved?.fingerprint===expected?saved.key:'');
  setStatus('Preparando envio criptografado…');
  const info=await request<EncryptionInfo>(c,'/settings/gemini','GET',undefined,signal);
  const envelope=keyEnvelope(value,info,expected,await getRandomBytesAsync(32));
  const result=await request<{configured:boolean;message:string}>(c,'/settings/gemini','PUT',JSON.stringify(envelope),signal);
  if(!result.configured)throw Error('O Mac não confirmou a aplicação da chave.');
  const secret={key:value,fingerprint:expected};
  try{await SecureStore.setItemAsync(GEMINI,JSON.stringify(secret));}catch{setStatus('Chave aplicada ao Mac.');throw Error('Não foi possível salvar no iPhone. Mantenha a chave disponível para a próxima configuração.');}
  setSaved(secret);setKey('');setStatus('Chave salva no iPhone e aplicada ao Mac. Você já pode gerar resumos e mapas. A validade será confirmada na próxima chamada ao Gemini.');
 }
 return <Screen back title="Configurações"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
  <Text style={styles.title}>Tudo pronto,{ '\n' }sem Terminal.</Text><Text style={styles.note}>Configure o Mac uma vez e atualize a chave Gemini por aqui.</Text>
  <View style={styles.card}><Text style={styles.subtitle}>Conexão ao Mac</Text><Text style={styles.note}>Abra http://127.0.0.1:5180/mobile-setup no Mac para obter os dados.</Text>
   <TextInput accessibilityLabel="Endereço do Mac" style={styles.input} value={url} onChangeText={setUrl} placeholder="http://192.168.1.10:5180" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy}/>
   <TextInput accessibilityLabel="Código de acesso ao Mac" style={styles.input} value={token} onChangeText={setToken} placeholder="Código de acesso do Mac" secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy}/>
   <Pressable disabled={busy} style={styles.secondary} onPress={()=>void perform(connect)}><Text style={styles.link}>Conectar ao Mac</Text></Pressable>
  </View>
  <View style={styles.card}><Text style={styles.subtitle}>Gemini</Text>
   <Text style={styles.note}>Na primeira vez, copie também o identificador de segurança exibido no Mac. Ele confirma o destino da chave.</Text>
   <TextInput accessibilityLabel="Identificador de segurança do Mac" style={styles.input} value={pin} onChangeText={setPin} placeholder="Identificador de segurança do Mac" multiline autoCapitalize="none" autoCorrect={false} editable={!busy}/>
   <TextInput accessibilityLabel="Nova chave Gemini" style={styles.input} value={key} onChangeText={v=>{setKey(v);setConfirmed(false);}} placeholder={saved?'Cole uma nova chave ou use a salva':'Cole a chave Gemini'} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" editable={!busy}/>
   {saved&&<Text style={styles.note}>Chave salva neste iPhone. O campo fica vazio por privacidade; não é necessário colá-la novamente.</Text>}
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} disabled={busy} style={styles.checkbox} onPress={()=>setConfirmed(!confirmed)}><View style={[styles.box,confirmed&&styles.checked]}><Text style={{color:'white'}}>{confirmed?'✓':''}</Text></View><Text style={[styles.note,{flex:1}]}>Confirmo que o projeto Gemini está no nível gratuito.</Text></Pressable>
   <Pressable disabled={busy||!config} style={[styles.primary,(busy||!config)&&styles.disabled]} onPress={()=>void perform(apply)}><Text style={styles.primaryText}>{busy?'Aplicando…':(key||!saved)?'Salvar e aplicar chave':'Aplicar chave salva'}</Text></Pressable>
   <Pressable onPress={()=>void Linking.openURL('https://aistudio.google.com/app/api-keys')}><Text style={styles.link}>Onde encontro minha chave?</Text></Pressable>
   {saved&&<Pressable disabled={busy} onPress={()=>void perform(async()=>{await SecureStore.deleteItemAsync(GEMINI);setSaved(null);setKey('');setConfirmed(false);setStatus('Chave removida do iPhone. A configuração em uso no Mac não foi alterada.');})}><Text style={styles.note}>Esquecer chave no iPhone</Text></Pressable>}
  </View>
  {busy&&<ActivityIndicator color={colors.blue}/>}{!!status&&<Text style={styles.note} accessibilityLiveRegion="polite">{status}</Text>}{!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
  <Text style={styles.note}>A chave fica salva com segurança no iPhone e criptografada no Mac. O backend atualizado restaura a configuração ao reiniciar. Use Aplicar chave salva se precisar sincronizar novamente. O servidor precisa continuar rodando.</Text>
 </ScrollView></Screen>;
}
const styles=StyleSheet.create({content:{padding:24,paddingBottom:45,gap:22},title:{fontSize:31,lineHeight:38,fontWeight:'700',letterSpacing:-1,color:colors.ink},subtitle:{fontSize:19,fontWeight:'600',color:colors.ink},note:{fontSize:13,lineHeight:22,color:colors.muted},card:{padding:22,borderRadius:24,backgroundColor:'white',gap:18},input:{borderWidth:1,borderColor:colors.line,borderRadius:14,padding:14,fontSize:14,color:colors.ink,backgroundColor:colors.background},primary:{padding:17,borderRadius:16,alignItems:'center',backgroundColor:colors.blue},primaryText:{fontSize:14,color:'white',fontWeight:'600'},secondary:{padding:15,borderRadius:15,backgroundColor:colors.paleBlue,alignItems:'center'},link:{fontSize:13,lineHeight:20,fontWeight:'600',color:colors.blue},disabled:{opacity:.45},error:{padding:16,borderRadius:16,color:colors.red,backgroundColor:'#FFF0F1',lineHeight:22},checkbox:{flexDirection:'row',gap:12,alignItems:'center'},box:{width:23,height:23,borderWidth:1,borderColor:colors.line,borderRadius:6,alignItems:'center',justifyContent:'center'},checked:{backgroundColor:colors.blue,borderColor:colors.blue}});
