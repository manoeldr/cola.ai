import type { ReactNode } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from './Icon';
import { colors } from './theme';
export function Screen({children,title,back=false,action}:{children:ReactNode;title?:string;back?:boolean;action?:ReactNode}){
 return <SafeAreaView style={styles.page} edges={['top','left','right']}>
  <View style={styles.header}>
   {back?<Pressable accessibilityLabel="Voltar" style={styles.icon} onPress={()=>router.back()}><Icon name="back"/></Pressable>:<Text style={styles.brand}>Cola<Text style={{color:colors.blue}}>.ai</Text></Text>}
   {title&&<Text style={styles.title}>{title}</Text>}{action}
  </View>{children}
 </SafeAreaView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},header:{paddingHorizontal:24,paddingVertical:16,minHeight:72,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},brand:{fontSize:26,fontWeight:'800',letterSpacing:-1,color:colors.ink},title:{fontSize:16,color:colors.ink,fontWeight:'600',flex:1},icon:{width:44,height:44,borderRadius:16,backgroundColor:'white',alignItems:'center',justifyContent:'center'}});
