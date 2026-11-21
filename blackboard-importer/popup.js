let result;
const extractButton = document.getElementById('extract');
const downloadButton = document.getElementById('download');
const scan = document.getElementById('scan');
const exportButton = document.getElementById('export');
const verifyButton = document.getElementById('verify');
const status = document.getElementById('status');
const container = document.getElementById('result');
scan.addEventListener('click', async () => {
  scan.disabled = true;
  exportButton.disabled = true;
  verifyButton.disabled = true;
  downloadButton.disabled = true;
  extractButton.disabled = true;
  result = undefined;
  container.replaceChildren();
  status.textContent = 'Analisando…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || new URL(tab.url).hostname !== 'bb.cruzeirodosulvirtual.com.br') {
      throw new Error('Abra o Blackboard da Cruzeiro do Sul e tente novamente.');
    }
    const responses = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractBlackboard });
    result = responses[0]?.result;
    if (result) result.extensionVersion = chrome.runtime.getManifest().version;
    if (!result) throw new Error('Não foi possível ler esta página.');
    status.textContent = `${result.headings.length} títulos e ${result.links.length} links encontrados. Confira os candidatos abaixo.`;
    const title = document.createElement('h3');
    title.textContent = result.page.title;
    container.append(title);
    const headings = document.createElement('p');
    headings.textContent = result.headings.join(' • ') || 'Nenhum título encontrado. Abra a disciplina e aguarde o carregamento.';
    container.append(headings);
    const list = document.createElement('ul');
    // Keep other links in JSON for diagnostics, without mistaking navigation for material.
    const candidates = result.links.filter(link => ['possivel-arquivo', 'avaliacao', 'disciplina'].includes(link.type));
    for (const link of candidates) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = link.label;
      a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = link.type;
      li.append(a, tag); list.append(li);
    }
    container.append(list);
    const embedded = document.createElement('p');
    embedded.textContent = `${result.embeddedResources.length} visualizador(es) incorporado(s) identificado(s). Endereços incluídos no JSON para diagnóstico.`;
    container.append(embedded);
    if (!candidates.length) status.textContent += '\nNenhum link candidato identificado. O JSON contém os demais links para diagnóstico.';
    exportButton.disabled = false;
    downloadButton.disabled = !result.embeddedResources.some(item => { try { const u = new URL(item.url); return u.origin === new URL(result.page.url).origin && u.pathname.startsWith('/bbcswebdav/'); } catch { return false; } });
    extractButton.disabled = downloadButton.disabled;
    verifyButton.disabled = !result.embeddedResources.some(item => {
      try { const u = new URL(item.url); return u.origin === new URL(result.page.url).origin && u.pathname.startsWith('/bbcswebdav/'); } catch { return false; }
    });
  } catch (error) { status.textContent = error.message || 'Erro ao analisar a página.'; }
  finally { scan.disabled = false; }
});
exportButton.addEventListener('click', () => {
  if (!result) return;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cola-ai-blackboard-diagnostico.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

verifyButton.addEventListener('click', async () => {
  if (!result) return;
  verifyButton.disabled = true;
  scan.disabled = true;
  exportButton.disabled = true;
  status.textContent = 'Verificando resposta e assinatura do PDF…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url !== result.page.url) throw new Error('A página mudou. Analise novamente antes de verificar.');
    const resource = result.embeddedResources.find(item => {
      const u = new URL(item.url);
      return u.origin === new URL(result.page.url).origin && u.pathname.startsWith('/bbcswebdav/');
    });
    const check = await (async (href) => {
        const url = new URL(href);
        if (url.origin !== 'https://bb.cruzeirodosulvirtual.com.br' || !url.pathname.startsWith('/bbcswebdav/')) throw new Error('Endereço fora do escopo do teste.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        let reader;
        try {
          let response = await fetch(url.href, { credentials: 'include', signal: controller.signal });
          let requestMode = 'visualizador';
          const attempts = [{ mode: requestMode, status: response.status, contentType: response.headers.get('content-type'), finalOrigin: new URL(response.url).origin }];
          if (response.ok && /text\/html/i.test(response.headers.get('content-type') || '')) {
            if (response.body) response.body.cancel().catch(() => {});
            const downloadUrl = new URL(url.href);
            downloadUrl.searchParams.delete('isInlineRender');
            downloadUrl.searchParams.delete('render');
            downloadUrl.searchParams.set('xythos-download', 'true');
            requestMode = 'sem-render-inline';
            response = await fetch(downloadUrl.href, { credentials: 'include', signal: controller.signal });
            attempts.push({ mode: requestMode, status: response.status, contentType: response.headers.get('content-type'), finalOrigin: new URL(response.url).origin });
          }
          const metadata = { requestMode, attempts, finalOrigin: new URL(response.url).origin, status: response.status, contentType: response.headers.get('content-type'), verifiedPdf: false };
          if (!response.ok || !response.body) return metadata;
          reader = response.body.getReader();
          const prefix = new Uint8Array(1024);
          let length = 0;
          while (length < prefix.length) {
            const {value, done} = await reader.read();
            if (done) break;
            const chunk = value.subarray(0, prefix.length - length);
            prefix.set(chunk, length); length += chunk.length;
          }
          metadata.bytesInspected = length;
          metadata.verifiedPdf = new TextDecoder('latin1').decode(prefix.subarray(0, length)).includes('%PDF-');
          return metadata;
        } catch (error) {
          return { verifiedPdf: false, error: error.name === 'AbortError' ? 'Tempo limite de 20 segundos excedido.' : String(error.message || error) };
        } finally {
          if (reader) reader.cancel().catch(() => {});
          controller.abort(); clearTimeout(timer);
        }
    })(resource.url);
    if (!check || typeof check.verifiedPdf !== 'boolean') {
      throw new Error('O navegador não devolveu o resultado da verificação. A página pode ter mudado ou a execução ter sido interrompida.');
    }
    result.pdfAccessCheck = { checkedAt: new Date().toISOString(), ...check };
    status.textContent = check.error
      ? `Não foi possível verificar: ${check.error}. Salve o JSON para diagnóstico.`
      : check.verifiedPdf
        ? 'Confirmado: o endereço retornou uma assinatura PDF. Salve o JSON. O conteúdo completo ainda não foi extraído.'
        : `PDF não confirmado (HTTP ${check.status}). Salve o JSON para diagnóstico.`;
  } catch (error) {
    if (result) result.pdfAccessCheck = { checkedAt: new Date().toISOString(), verifiedPdf: false, error: String(error.message || error) };
    status.textContent = `Não foi possível verificar: ${error.message}. Salve o JSON para diagnóstico.`;
  }
  finally { scan.disabled = false; exportButton.disabled = !result; verifyButton.disabled = false; }
});

downloadButton.addEventListener('click', async () => {
  if (!result) return;
  for (const button of [scan, verifyButton, exportButton, downloadButton]) button.disabled = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url !== result.page.url) throw new Error('A página mudou. Analise novamente.');
    const resource = result.embeddedResources.find(item => {
      const u = new URL(item.url);
      return u.origin === 'https://bb.cruzeirodosulvirtual.com.br' && u.pathname.startsWith('/bbcswebdav/');
    });
    if (!resource) throw new Error('Abra a tela do PDF e analise novamente.');
    const url = new URL(resource.url);
    url.searchParams.delete('render'); url.searchParams.delete('isInlineRender');
    url.searchParams.set('xythos-download', 'true');
    status.textContent = 'Buscando o PDF completo… Mantenha este painel aberto.';
    const response = await fetch(url.href, { credentials: 'include', signal: controller.signal });
    const bytes = await readFullPdf(response);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    const name = (resource.title || 'material.pdf').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
    a.download = name.toLowerCase().endsWith('.pdf') ? name : name + '.pdf';
    a.click(); setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    result.fullPdfDownload = { checkedAt: new Date().toISOString(), bytesReceived: bytes.length, sha256, saveRequested: true };
    status.textContent = `PDF completo recebido: ${bytes.length.toLocaleString('pt-BR')} bytes. Salvamento solicitado ao navegador. Salve o JSON e confira o arquivo em Downloads.`;
  } catch (error) {
    result.fullPdfDownload = { checkedAt: new Date().toISOString(), error: String(error.message || error) };
    status.textContent = `Não foi possível baixar: ${error.name === 'AbortError' ? 'Tempo limite de 60 segundos.' : error.message}`;
  } finally {
    controller.abort(); clearTimeout(timer);
    for (const button of [scan, verifyButton, exportButton, downloadButton]) button.disabled = false;
  }
});

extractButton.addEventListener('click', async () => {
  if (!result) return;
  const resource = result.embeddedResources.find(item => {
    const u = new URL(item.url);
    return u.origin === 'https://bb.cruzeirodosulvirtual.com.br' && u.pathname.startsWith('/bbcswebdav/');
  });
  if (!resource) return;
  const course = result.links.find(link => link.type === 'disciplina');
  const params = new URLSearchParams({source:resource.url,name:resource.title || 'material.pdf',course:course?.label || '',courseUrl:course?.url || ''});
  await chrome.tabs.create({url:chrome.runtime.getURL('reader.html')+'#'+params});
});

document.getElementById('crawl').addEventListener('click', async()=>{
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const url=new URL(tab.url);
  if(url.hostname!=='bb.cruzeirodosulvirtual.com.br'||!/^\/ultra\/courses\/[^/]+\/outline\/?$/.test(url.pathname))throw Error('Abra Conteúdo de uma disciplina, fora da tela do PDF.');
  await chrome.tabs.create({url:chrome.runtime.getURL('crawler.html')+'#tab='+tab.id});
 }catch(e){status.textContent=e.message;}
});

document.getElementById('batch').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('batch.html')});
