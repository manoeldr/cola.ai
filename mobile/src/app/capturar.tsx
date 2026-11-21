import { useRef,useState } from 'react';
import { ActivityIndicator,Image,Linking,Pressable,StyleSheet,Text,View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView,useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '../ui/Icon';
import { colors } from '../ui/theme';
import { savePhoto } from '../photos/storage';
export default function Capture(){
 const [permission,requestPermission]=useCameraPermissions();
 const camera=useRef<CameraView>(null);const lock=useRef(false);
 const [ready,setReady]=useState(false),[uri,setUri]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function take(){if(lock.current||!ready)return;lock.current=true;setBusy(true);setError('');try{const picture=await camera.current?.takePictureAsync({quality:0.85});if(!picture)throw Error('Não foi possível capturar a foto.');setUri(picture.uri);}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function save(){if(!uri||lock.current)return;lock.current=true;setBusy(true);setError('');try{const photo=await savePhoto(uri);router.replace({pathname:'/pagina',params:{id:photo.id}});}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 if(!permission)return <SafeAreaView style={styles.permission}><ActivityIndicator color={colors.blue}/></SafeAreaView>;
 if(!permission.granted)return <SafeAreaView style={styles.permission}>
  <View style={styles.permissionIcon}><Icon name="camera" size={52} color={colors.blue}/></View><Text style={styles.title}>A câmera é sua entrada.</Text><Text style={styles.note}>Permita o acesso para fotografar uma página inteira. As fotos são salvas no seu histórico.</Text>
  <Pressable style={styles.primary} onPress={()=>{if(permission.canAskAgain)void requestPermission();else void Linking.openSettings();}}><Text style={styles.primaryText}>{permission.canAskAgain?'Permitir câmera':'Abrir ajustes do iPhone'}</Text></Pressable>
  <Pressable style={styles.secondary} onPress={()=>router.back()}><Text style={styles.link}>Agora não</Text></Pressable>
 </SafeAreaView>;
 return <SafeAreaView style={styles.page}><StatusBar style="light"/>
  <View style={styles.header}><Pressable disabled={busy} accessibilityLabel="Fechar câmera" style={styles.close} onPress={()=>router.back()}><Icon name="close" color="white"/></Pressable><Text style={styles.headerText}>{uri?'Confira a página':'Página inteira'}</Text><View style={{width:44}}/></View>
  <View style={styles.preview}>{uri?<Image accessibilityLabel="Foto capturada" source={{uri}} style={styles.image} resizeMode="contain"/>:<CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" onCameraReady={()=>setReady(true)} onMountError={()=>setError('Não foi possível abrir a câmera. Feche e tente novamente.')}/>}</View>
  <View style={styles.controls}>
   {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
   {busy?<ActivityIndicator color="white"/>:uri?<View style={styles.review}><Pressable style={styles.secondary} onPress={()=>{setReady(false);setUri(null);}}><Text style={styles.white}>Refazer</Text></Pressable><Pressable style={styles.primary} onPress={()=>void save()}><Text style={styles.primaryText}>Salvar página</Text></Pressable></View>:<Pressable accessibilityLabel="Tirar foto da página" disabled={!ready} onPress={()=>void take()} style={[styles.shutter,!ready&&{opacity:0.4}]}><View style={styles.shutterInner}/></Pressable>}
  </View>
 </SafeAreaView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#10192B'},header:{paddingHorizontal:18,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},close:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#273248'},headerText:{fontSize:15,color:'white',fontWeight:'600'},preview:{flex:1,marginHorizontal:12,borderRadius:24,overflow:'hidden',backgroundColor:'#1B263A'},image:{width:'100%',height:'100%'},controls:{minHeight:145,padding:26,alignItems:'center',justifyContent:'center',gap:12},shutter:{width:76,height:76,borderRadius:38,borderWidth:3,borderColor:'white',alignItems:'center',justifyContent:'center'},shutterInner:{width:60,height:60,borderRadius:30,backgroundColor:'white'},review:{flexDirection:'row',gap:20,alignItems:'center'},primary:{padding:18,borderRadius:18,backgroundColor:colors.blue,alignItems:'center',minHeight:54},primaryText:{color:'white',fontWeight:'600',fontSize:15},secondary:{padding:18},white:{color:'white'},permission:{flex:1,backgroundColor:colors.background,padding:32,justifyContent:'center',gap:24},permissionIcon:{width:106,height:106,borderRadius:53,backgroundColor:colors.paleBlue,alignItems:'center',justifyContent:'center'},title:{fontSize:30,fontWeight:'700',color:colors.ink},note:{fontSize:16,lineHeight:25,color:colors.muted},link:{color:colors.muted,textAlign:'center'},error:{fontSize:13,lineHeight:20,color:'#FFB4B4'}});
