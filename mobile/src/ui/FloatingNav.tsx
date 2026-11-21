import { router,usePathname } from 'expo-router';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from './theme';
import { tabSlide } from './tabMotion';
export function FloatingNav(){
 const path=usePathname(),insets=useSafeAreaInsets();
 if(!['/','/estudar','/historico','/resumos'].includes(path))return null;
 const selected=path==='/resumos'?'/estudar':path;
 return <View pointerEvents="box-none" style={[styles.container,{bottom:Math.max(insets.bottom,14)}]}>
  <View style={styles.island}>
   {([{path:'/estudar',name:'book',label:'Estudar'},{path:'/',name:'camera',label:'Foto'},{path:'/historico',name:'clock',label:'Histórico'}] as const).map(tab=>{
    const active=selected===tab.path;
    return <Pressable key={tab.path} accessibilityRole="tab" accessibilityState={{selected:active}} accessibilityLabel={tab.label} onPress={()=>{if(!active)router.replace({pathname:tab.path,params:{tabSlide:tabSlide(path,tab.path)}});}} style={[styles.tab,active&&styles.active]}>
     <Icon name={tab.name} color={active?colors.blue:colors.muted} size={22}/><Text style={[styles.label,active&&styles.activeLabel]}>{tab.label}</Text>
    </Pressable>;
   })}
  </View>
 </View>;
}
const styles=StyleSheet.create({container:{position:'absolute',left:28,right:28,alignItems:'center'},island:{flexDirection:'row',padding:7,gap:4,borderRadius:30,backgroundColor:'white',borderWidth:1,borderColor:'#EEF1F7',boxShadow:'0 8px 32px rgba(27,53,101,0.13)',width:'100%',maxWidth:380},tab:{flex:1,alignItems:'center',justifyContent:'center',gap:5,paddingVertical:10,borderRadius:24,minHeight:58},active:{backgroundColor:colors.paleBlue},label:{fontSize:11,color:colors.muted,fontWeight:'500'},activeLabel:{color:colors.blue,fontWeight:'700'}});
