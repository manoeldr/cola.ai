import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File,Paths } from 'expo-file-system';
import type { Summary } from '../study/api';
import { pdfFilename,summaryHtml,type SummaryDocument } from './summaryHtml';
export async function exportSummary(result:Summary,course:string,documents:SummaryDocument[]):Promise<void>{
 if(!await Sharing.isAvailableAsync())throw Error('O compartilhamento de PDF não está disponível neste dispositivo.');
 const html=summaryHtml(result,course,documents);
 const printed=await Print.printToFileAsync({html,width:595.28,height:841.89,margins:{top:48,right:48,bottom:48,left:48}});
 const source=new File(printed.uri),target=new File(Paths.cache,pdfFilename(course));
 try{
  if(printed.numberOfPages<1||!source.exists)throw Error('Não foi possível criar o PDF. Tente novamente.');
  await source.copy(target,{overwrite:true});
  await Sharing.shareAsync(target.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Salvar ou compartilhar resumo'});
 }finally{if(source.exists)source.delete();}
}
