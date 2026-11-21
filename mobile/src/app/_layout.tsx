import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { FloatingNav } from '../ui/FloatingNav';
import { tabAnimation } from '../ui/tabMotion';
export default function RootLayout(){return <View style={{flex:1}}><StatusBar style="dark"/><Stack screenOptions={({route})=>({headerShown:false,contentStyle:{backgroundColor:'#F5F7FC'},animation:tabAnimation((route.params as {tabSlide?:string}|undefined)?.tabSlide),animationTypeForReplace:'push'})}/><FloatingNav/></View>;}
