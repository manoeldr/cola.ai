import Svg,{Path,Circle} from 'react-native-svg';
import { colors } from './theme';
export type IconName='camera'|'book'|'clock'|'arrow'|'settings'|'plus'|'close'|'check'|'back'|'file';
export function Icon({name,size=24,color=colors.ink}:{name:IconName;size?:number;color?:string}){
 return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
  {name==='camera'&&<><Path d="M4 6.5h3l1.5-3h7l1.5 3h3a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V8A1.5 1.5 0 0 1 4 6.5Z"/><Circle cx={12} cy={13} r={4}/></>}
  {name==='book'&&<><Path d="M12 5.5C8 3 5 3 2.5 4v15c3-1 6-.5 9.5 1.5 3.5-2 6.5-2.5 9.5-1.5V4c-2.5-1-5.5-1-9.5 1.5ZM12 5.5v15"/></>}
  {name==='clock'&&<><Circle cx={12} cy={12} r={9}/><Path d="M12 7v5l3.5 2"/></>}
  {name==='arrow'&&<Path d="m9 5 7 7-7 7"/>}
  {name==='back'&&<Path d="m15 5-7 7 7 7"/>}
  {name==='plus'&&<Path d="M12 5v14M5 12h14"/>}
  {name==='close'&&<Path d="m6 6 12 12M18 6 6 18"/>}
  {name==='check'&&<Path d="m5 12 4 4 10-10"/>}
  {name==='settings'&&<><Circle cx={12} cy={12} r={3}/><Path d="m9 3 6 0 .7 2.5 2.2 1.3 2.5-.6 3 5.2-1.8 1.9v2.5l1.8 1.8-3 5.2-2.5-.6-2.2 1.3L15 21H9l-.7-2.5-2.2-1.3-2.5.6-3-5.2 1.8-1.8V8.3L.6 6.5l3-5.2 2.5.6 2.2-1.3Z" transform="translate(2 2) scale(.83)"/></>}
  {name==='file'&&<><Path d="M14 2.5H5v19h14V7.5Z M14 2.5v5h5 M8 12h8 M8 16h6"/></>}
 </Svg>;
}
