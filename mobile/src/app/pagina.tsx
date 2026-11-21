import { useEffect,useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image,StyleSheet,Text,View } from 'react-native';
import { Screen } from '../ui/Screen';
import { listPhotos,photoUri,type LocalPhoto } from '../photos/storage';
import { colors } from '../ui/theme';
export default function Page(){
 const {id}=useLocalSearchParams<{id:string}>();const [photo,setPhoto]=useState<LocalPhoto|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void listPhotos().then(items=>{if(alive){const found=items.find(p=>p.id===id);if(found)setPhoto(found);else setError('Esta página não foi encontrada.');}}).catch(()=>{if(alive)setError('Não foi possível abrir a página.');});return()=>{alive=false;};},[id]);
 return <Screen back title="Página salva"><View style={styles.content}>
  {photo&&<><Text style={styles.course}>{photo.course||'Sem disciplina'}</Text><Image accessibilityLabel="Página fotografada" source={{uri:photoUri(photo.id)}} resizeMode="contain" style={styles.photo}/><View style={styles.card}><Text style={styles.title}>Guardada no seu histórico.</Text><Text style={styles.note}>O gabarito desta foto ainda não foi gerado.</Text></View></>}
  {!!error&&<Text style={styles.error}>{error}</Text>}
 </View></Screen>;
}
const styles=StyleSheet.create({content:{flex:1,padding:24,gap:20,paddingBottom:40},course:{fontSize:15,lineHeight:23,color:colors.ink,fontWeight:'600'},photo:{width:'100%',flex:1,backgroundColor:'white',borderRadius:20},card:{backgroundColor:colors.paleBlue,borderRadius:20,padding:20,gap:8},title:{fontSize:16,fontWeight:'600',color:colors.ink},note:{fontSize:13,lineHeight:21,color:colors.muted},error:{color:colors.red}});
