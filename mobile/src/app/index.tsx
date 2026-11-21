import { useCallback,useState } from 'react';
import { router,useFocusEffect } from 'expo-router';
import { Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { Screen } from '../ui/Screen';
import { Icon } from '../ui/Icon';
import { colors } from '../ui/theme';
import { readCorpus,shortCourse } from '../library/local';
export default function PhotoHome(){
 const [course,setCourse]=useState<string|null>(null);
 useFocusEffect(useCallback(()=>{let alive=true;void readCorpus().then(c=>{if(alive)setCourse(c?shortCourse(c.course.title):null);}).catch(()=>{});return()=>{alive=false;};},[]));
 return <Screen action={<Pressable accessibilityLabel="Configurações de conexão" style={styles.settings} onPress={()=>router.push({pathname:'/resumos',params:{settings:'1'}})}><Icon name="settings" size={21}/></Pressable>}>
  <ScrollView contentContainerStyle={styles.content}>
   <View style={styles.intro}><Text style={styles.eyebrow}>SEU ASSISTENTE ACADÊMICO</Text><Text style={styles.title}>Tudo começa{ '\n' }com uma foto.</Text><Text style={styles.subtitle}>Uma página inteira, várias questões.</Text></View>
   <View style={styles.cameraArea}>
    <View style={styles.halo}><Pressable accessibilityRole="button" accessibilityLabel="Abrir câmera" style={({pressed})=>[styles.camera,pressed&&{transform:[{scale:0.96}]}]} onPress={()=>router.push('/capturar')}><Icon name="camera" size={70} color={colors.blue}/></Pressable></View>
    <Text style={styles.cameraLabel}>Toque para abrir a câmera</Text>
   </View>
   <Pressable style={styles.course} onPress={()=>router.push('/estudar')}><View style={styles.courseIcon}><Icon name="book" color={colors.blue} size={22}/></View><View style={{flex:1,gap:4}}><Text style={styles.small}>SEUS MATERIAIS</Text><Text numberOfLines={2} style={styles.courseName}>{course||'Adicione sua primeira disciplina'}</Text></View><Icon name="arrow" size={18} color={colors.muted}/></Pressable>
  </ScrollView>
 </Screen>;
}
const styles=StyleSheet.create({settings:{width:44,height:44,borderRadius:16,backgroundColor:'white',alignItems:'center',justifyContent:'center'},content:{flexGrow:1,paddingHorizontal:26,paddingTop:32,paddingBottom:120,gap:24},intro:{gap:14},eyebrow:{fontSize:10,letterSpacing:2,color:colors.muted,fontWeight:'700'},title:{fontSize:38,lineHeight:43,letterSpacing:-1.5,fontWeight:'700',color:colors.ink},subtitle:{fontSize:15,lineHeight:23,color:colors.muted},cameraArea:{alignItems:'center',justifyContent:'center',flex:1,minHeight:240,gap:25,paddingVertical:20},halo:{width:224,height:224,borderRadius:112,backgroundColor:'#F0F3FC',alignItems:'center',justifyContent:'center'},camera:{width:178,height:178,borderRadius:89,backgroundColor:'#E2EAFF',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#D8E3FF'},cameraLabel:{fontSize:13,color:colors.muted},course:{flexDirection:'row',alignItems:'center',gap:14,padding:18,borderRadius:22,backgroundColor:'white',borderWidth:1,borderColor:colors.line},courseIcon:{width:44,height:48,alignItems:'center',justifyContent:'center',backgroundColor:colors.paleBlue,borderRadius:14},small:{fontSize:9,fontWeight:'700',letterSpacing:1.3,color:colors.muted},courseName:{fontSize:14,lineHeight:21,fontWeight:'600',color:colors.ink}});
