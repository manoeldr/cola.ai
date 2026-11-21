import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BLACKBOARD_ORIGIN, buildScanScript, downloadUrl, isBlackboardPage, validateScan, type Scan } from '../blackboard/scanner';

import { PdfExtractor, type PdfHandle } from '../importer/PdfExtractor';
import { useCourseImport } from '../importer/useCourseImport';

type PdfCheck = { status: number; contentType: string | null; bytesRead: number; verifiedPdf: boolean; finalHost: string };
const INITIAL_URL = `${BLACKBOARD_ORIGIN}/ultra/course`;
export default function BlackboardTest() {
  const web = useRef<WebView<object>>(null);
  const extractor = useRef<PdfHandle>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [actionsOpen,setActionsOpen]=useState(false);
  const [diagnostics,setDiagnostics]=useState(false);
  const [opened, setOpened] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(INITIAL_URL);
  const [source, setSource] = useState({ uri: INITIAL_URL });
  const [status, setStatus] = useState('Abra a disciplina no Blackboard para importar os materiais.');
  const [scan, setScan] = useState<Scan | null>(null);
  const [pdf, setPdf] = useState<PdfCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const importer = useCourseImport(web, extractor, url => setSource({ uri: url }));
  useEffect(() => () => { if (scanTimer.current) clearTimeout(scanTimer.current); controller.current?.abort(); }, []);
  function scanPage() {
    if (!isBlackboardPage(currentUrl)) { setStatus('Conclua o login e volte à página do Blackboard antes de analisar.'); return; }
    setBusy(true); setPdf(null); setStatus('Lendo os títulos e links da página aberta…');
    web.current?.injectJavaScript(buildScanScript());
    scanTimer.current = setTimeout(() => { setBusy(false); setStatus('A página não respondeu. Aguarde o carregamento e tente novamente.'); }, 12000);
  }
  function message(event: WebViewMessageEvent) {
    if (importer.message(event)) return;
    try {
      const result = validateScan(event.nativeEvent.data, event.nativeEvent.url);
      if (scanTimer.current) clearTimeout(scanTimer.current);
      setScan(result); setBusy(false); setShowReport(true); setActionsOpen(false);
      setStatus(`${result.links.filter(l => l.type === 'course').length} matéria(s), ${result.links.filter(l => l.type === 'file').length} arquivo(s) identificado(s).${result.pdfUrl ? ' Endereço do PDF encontrado.' : ''}`);
    } catch { /* Ignore unrelated messages without exposing page data. */ }
  }
  async function verifyPdf() {
    if (!scan?.pdfUrl) return;
    setBusy(true); setStatus('Verificando o acesso nativo ao PDF…');
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 30000);
    try {
      const response = await fetch(downloadUrl(scan.pdfUrl), { credentials: 'include', headers: { Range: 'bytes=0-1023' }, signal: controller.current.signal });
      if (Number(response.headers.get('content-length') || 0) > 25 * 1024 * 1024) throw new Error('Arquivo acima do limite de 25 MB deste teste.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 25 * 1024 * 1024) throw new Error('Arquivo acima do limite deste teste.');
      const prefix = Array.from(bytes.slice(0, 1024), byte => String.fromCharCode(byte)).join('');
      const result: PdfCheck = { status: response.status, contentType: response.headers.get('content-type'), bytesRead: bytes.length, verifiedPdf: response.ok && prefix.includes('%PDF-'), finalHost: new URL(response.url).hostname };
      setPdf(result);
      setStatus(result.verifiedPdf ? 'Acesso ao PDF confirmado no iPhone. A extração do texto será a próxima etapa.' : 'O endereço não retornou PDF. Precisamos ajustar o compartilhamento da sessão de login ou o download no iOS.');
    } catch { setStatus('Não foi possível confirmar o PDF. O download autenticado no iOS ainda precisa de ajuste; isso não significa que o arquivo esteja indisponível.'); }
    finally { clearTimeout(timer); controller.current = null; setBusy(false); }
  }
  async function shareReport() {
    if (!scan) return;
    const clean = (value: string) => { const u = new URL(value); return u.origin + u.pathname; };
    await Share.share({ message: JSON.stringify({ version: 'mobile-poc-1', platform: 'ios-test', title: scan.title, page: clean(scan.page), links: scan.links.map(l => ({ ...l, url: clean(l.url) })), pdfResourceFound: !!scan.pdfUrl, pdf }, null, 2) });
  }
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable disabled={importer.running} accessibilityLabel="Voltar para Estudar" onPress={()=>router.back()} style={styles.smallButton}><Text>Voltar</Text></Pressable>
      <View style={{alignItems:'center',gap:2}}><Text style={[styles.logo,opened&&styles.compactLogo]}>Blackboard</Text><Text style={{fontSize:8,color:'#5b6d87',letterSpacing:1}}>POR DISCIPLINA · V6</Text></View>
      <Pressable onPress={()=>opened?setActionsOpen(true):router.push({pathname:'/resumos',params:importer.report?{source:importer.report.course.url}:{}})} style={[styles.smallButton,opened&&styles.blue]}><Text style={opened?styles.primaryText:undefined}>{opened?'Ações':'Resumos'}</Text></Pressable>
    </View>
    {!opened ? <View style={styles.intro}>
      <Text style={styles.title}>Suas matérias,{"\n"}no celular.</Text>
      <Text style={styles.body}>Entre no Blackboard, abra o Conteúdo da disciplina e importe os materiais. As pastas reconhecidas serão abertas automaticamente.</Text>
      <Pressable style={styles.primary} onPress={() => setOpened(true)}><Text style={styles.primaryText}>Conectar Blackboard</Text></Pressable>
      <Text style={styles.note}>Faça login normalmente na página da faculdade. Os materiais são salvos neste iPhone para preparar sua revisão.</Text>
    </View> : <>
      {importer.running&&<Text numberOfLines={2} style={styles.progressLine} accessibilityLiveRegion="polite">{importer.status}</Text>}
      <Modal visible={actionsOpen} transparent animationType="slide" onRequestClose={()=>setActionsOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar ações" style={StyleSheet.absoluteFill} onPress={()=>setActionsOpen(false)}/>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}><Text style={styles.subtitle}>Ações da disciplina</Text><Pressable style={styles.smallButton} onPress={()=>setActionsOpen(false)}><Text>Fechar</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.sheetContent} bounces={false}>
      <View style={styles.toolbar}>
        <Pressable disabled={!canGoBack || busy || importer.running} onPress={() => web.current?.goBack()} style={styles.smallButton}><Text>Voltar</Text></Pressable>
        {diagnostics&&<Pressable disabled={busy || importer.running} onPress={scanPage} style={[styles.smallButton, styles.blue]}><Text style={styles.primaryText}>Analisar página</Text></Pressable>}
        <Pressable disabled={importer.running} onPress={() => {setShowReport(!showReport);setActionsOpen(false);}} style={styles.smallButton}><Text>{showReport ? 'Ver Blackboard' : 'Ver resultado'}</Text></Pressable>
      </View>
      <Text style={styles.status} accessibilityLiveRegion="polite">{importer.status || status}</Text>
      <View style={styles.toolbar}>
        {diagnostics&&!importer.running && <Pressable disabled={busy} style={styles.smallButton} onPress={()=>{setActionsOpen(false);setShowReport(false);void importer.start(currentUrl,scan?.title||'',false,1);}}><Text>Testar 1 arquivo</Text></Pressable>}
        {!importer.running ? <Pressable disabled={busy} style={[styles.smallButton,styles.blue]} onPress={()=>{setActionsOpen(false);setShowReport(false);void importer.start(currentUrl,scan?.title||'');}}><Text style={styles.primaryText}>Importar disciplina</Text></Pressable> : <Pressable style={styles.smallButton} onPress={importer.stop}><Text>Parar importação</Text></Pressable>}
        {importer.report && !importer.running && <>
          {!importer.report.processingComplete&&<Pressable style={styles.smallButton} onPress={()=>{setActionsOpen(false);setShowReport(false);void importer.start(currentUrl,scan?.title||'',true);}}><Text>Retomar pendentes</Text></Pressable>}
          <Pressable style={styles.smallButton} onPress={()=>void importer.share()}><Text>Salvar acervo</Text></Pressable>
        </>}
      </View>
      <Pressable disabled={importer.running} onPress={()=>setDiagnostics(!diagnostics)}><Text style={styles.status}>{diagnostics?'Ocultar diagnóstico':'Opções de diagnóstico'}</Text></Pressable>
      {importer.report && <Pressable disabled={importer.running} onPress={()=>{setShowReport(true);setActionsOpen(false);}}><Text style={styles.status}>{importer.report.files.filter(f=>f.status==='concluido').length}/{importer.report.files.length} arquivos importados · Ver acervo</Text></Pressable>}
      {busy && <ActivityIndicator color="#2563eb" />}
              {importer.diagnostic&&!importer.running&&<Pressable style={styles.primary} onPress={()=>void importer.shareDiagnostic()}><Text style={styles.primaryText}>Salvar diagnóstico da disciplina</Text></Pressable>}
              <Pressable disabled={importer.running} style={styles.smallButton} onPress={()=>{setActionsOpen(false);router.push({pathname:'/resumos',params:importer.report?{source:importer.report.course.url}:{}});}}><Text>Abrir revisão</Text></Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <View pointerEvents={importer.running ? 'none' : 'auto'} style={[styles.browser, showReport && styles.hidden]}>
        <WebView<object> ref={web} source={source} sharedCookiesEnabled thirdPartyCookiesEnabled javaScriptEnabled domStorageEnabled
          javaScriptCanOpenWindowsAutomatically scrollEnabled nestedScrollEnabled
          onOpenWindow={({ nativeEvent }) => {
            try {
              const target = new URL(nativeEvent.targetUrl);
              if (target.protocol !== 'https:' || target.username || target.password) {
                setStatus('O portal tentou abrir uma janela sem endereço HTTPS válido.'); return;
              }
              setShowReport(false); setScan(null); setPdf(null);
              setStatus('Abrindo a janela do ambiente virtual dentro do aplicativo…');
              setSource({ uri: target.href });
            } catch { setStatus('O portal abriu uma janela sem endereço. Precisamos verificar esse fluxo de login.'); }
          }}
          onMessage={message} onNavigationStateChange={nav => { setCurrentUrl(nav.url); importer.navigation(nav.url); setCanGoBack(nav.canGoBack); }}
          onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://')}
          onError={() => setStatus('Falha ao abrir a página. Confira a conexão e tente recarregar.')}
          startInLoadingState renderLoading={() => <ActivityIndicator color="#2563eb" style={styles.loading} />} />
      </View>
      {showReport && <ScrollView style={styles.report} contentContainerStyle={styles.reportContent}>
        <Text style={styles.note} accessibilityLiveRegion="polite">{importer.status||status}</Text>
        {!importer.report&&<Text style={styles.subtitle}>Nenhum resultado desta disciplina ainda. Abra o Conteúdo da disciplina e inicie a importação.</Text>}
        {importer.report && <>
          <Text style={styles.subtitle}>Acervo · {importer.report.course.title}</Text>
          {importer.report.discovery.unsupported?.map(item=><Text key={item.url} style={styles.note}>Não importado pelo leitor de PDFs: {item.label}</Text>)}
          <Text style={styles.note}>Cobertura total não confirmada. {importer.report.discovery.failures.length} pendência(s) na abertura de pastas. Avaliações não são importadas.</Text>
          {importer.report.files.map(f=><View key={f.sourcePage} style={styles.linkRow}><Text style={styles.body}>{f.name}</Text><Text style={styles.note}>{f.status}{f.pageCount ? ` · ${f.pageCount} páginas · ${f.pagesNeedingOcr} precisam de OCR` : ''}{f.error ? ` · ${f.error}` : ''}</Text></View>)}
        </>}
        {importer.report?.processingComplete&&<Pressable style={styles.primary} onPress={()=>router.push({pathname:'/resumos',params:importer.report?{source:importer.report.course.url}:{}})}><Text style={styles.primaryText}>Preparar revisão</Text></Pressable>}
        {diagnostics&&<>
        <Text style={styles.subtitle}>{scan?.title || 'Abra uma disciplina'}</Text>
        <Text style={styles.note}>Diagnóstico opcional: analise a página aberta ou verifique um PDF individual.</Text>
        {scan?.links.map(link => <View key={link.url} style={styles.linkRow}><Text style={styles.linkType}>{link.type === 'file' ? 'ARQUIVO' : 'MATÉRIA'}</Text><Text style={styles.body}>{link.label}</Text></View>)}
        {scan?.pdfUrl && <Pressable disabled={busy} style={styles.primary} onPress={verifyPdf}><Text style={styles.primaryText}>Verificar acesso ao PDF</Text></Pressable>}
        {pdf && <Text style={styles.body}>HTTP {pdf.status} · {pdf.verifiedPdf ? 'PDF confirmado' : 'PDF não confirmado'} · {pdf.contentType}</Text>}
        {scan && <Pressable style={styles.smallButton} onPress={() => { void shareReport(); }}><Text>Compartilhar diagnóstico</Text></Pressable>}
        </>}
        <Pressable style={styles.smallButton} onPress={() => setShowReport(false)}><Text>Voltar ao Blackboard</Text></Pressable>
      </ScrollView>}
    </>}
    <PdfExtractor ref={extractor} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7fc' }, header: { paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactLogo:{fontSize:18},modalRoot:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(15,28,50,0.35)'},sheet:{maxHeight:'75%',backgroundColor:'#f4f7fc',borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden'},sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:18},sheetContent:{paddingBottom:24,gap:12},progressLine:{fontSize:12,lineHeight:17,color:'#5b6d87',paddingHorizontal:14,paddingBottom:8},
  logo: { fontSize: 25, fontWeight: '700', color: '#192d4c' }, tag: { fontSize: 10, letterSpacing: 1, color: '#5b6d87' },
  intro: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' }, title: { fontSize: 36, fontWeight: '600', color: '#192d4c', lineHeight: 41 },
  body: { fontSize: 15, lineHeight: 23, color: '#192d4c' }, note: { fontSize: 13, lineHeight: 20, color: '#5b6d87' },
  primary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 18, alignItems: 'center' }, primaryText: { color: 'white', fontWeight: '600' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12 }, smallButton: { backgroundColor: '#e3eaf5', borderRadius: 12, padding: 12, alignItems: 'center', minHeight: 44 }, blue: { backgroundColor: '#2563eb' },
  status: { fontSize: 12, color: '#5b6d87', padding: 12 }, browser: { flex: 1 }, hidden: { display: 'none' }, loading: { flex: 1 },
  report: { flex: 1 }, reportContent: { gap: 18, padding: 20 }, subtitle: { fontSize: 20, fontWeight: '600', color: '#192d4c' },
  linkRow: { backgroundColor: 'white', padding: 16, borderRadius: 14, gap: 5 }, linkType: { fontSize: 10, color: '#2563eb', fontWeight: '600', letterSpacing: 1 },
});
