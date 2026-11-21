export const BLACKBOARD_ORIGIN = 'https://bb.cruzeirodosulvirtual.com.br';
export type FoundLink = { label: string; url: string; type: 'course' | 'file' };
export type Scan = { title: string; page: string; links: FoundLink[]; pdfUrl: string | null };

export function isBlackboardPage(value: string): boolean {
  try { return new URL(value).origin === BLACKBOARD_ORIGIN; } catch { return false; }
}
export function validateScan(raw: string, originUrl: string): Scan {
  if (!isBlackboardPage(originUrl) || raw.length > 200_000) throw new Error('Resposta fora do escopo do teste.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Resposta inválida.');
  const d = value as Record<string, unknown>;
  if (d.kind !== 'cola-scan' || typeof d.title !== 'string' || typeof d.page !== 'string' || !isBlackboardPage(d.page) || !Array.isArray(d.links)) throw new Error('Mensagem não reconhecida.');
  const links: FoundLink[] = [];
  const seen = new Set<string>();
  for (const item of d.links.slice(0, 300)) {
    if (!item || typeof item !== 'object') continue;
    const link = item as Record<string, unknown>;
    if (typeof link.url !== 'string' || typeof link.label !== 'string' || !isBlackboardPage(link.url)) continue;
    const path = new URL(link.url).pathname;
    const type = /\/ultra\/courses\/[^/]+\/file\//.test(path) ? 'file' : /^\/ultra\/courses\/[^/]+\/outline\/?$/.test(path) ? 'course' : null;
    if (!type || seen.has(link.url)) continue;
    seen.add(link.url); links.push({ label: link.label.slice(0, 240), url: link.url, type });
  }
  const pdfUrl = typeof d.pdfUrl === 'string' && isBlackboardPage(d.pdfUrl) && new URL(d.pdfUrl).pathname.startsWith('/bbcswebdav/') ? d.pdfUrl : null;
  return { title: d.title.slice(0, 300), page: d.page, links, pdfUrl };
}
export function downloadUrl(value: string): string {
  if (!isBlackboardPage(value)) throw new Error('Arquivo fora do Blackboard configurado.');
  const url = new URL(value);
  if (!url.pathname.startsWith('/bbcswebdav/')) throw new Error('Endereço não corresponde a um material.');
  url.searchParams.delete('render'); url.searchParams.delete('isInlineRender');
  url.searchParams.set('xythos-download', 'true'); return url.href;
}
export function buildScanScript(): string {
  return `(() => {
    if (location.origin !== '${BLACKBOARD_ORIGIN}') return true;
    const links = [];
    for (const a of document.querySelectorAll('a[href]')) {
      if (!a.getClientRects().length) continue;
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.origin !== location.origin) continue;
        const label = (a.innerText || a.getAttribute('aria-label') || '').replace(/\\s+/g,' ').trim();
        if (label && /\\/ultra\\/courses\\//.test(u.pathname)) links.push({label,url:u.href});
      } catch {}
    }
    let pdfUrl = null;
    for (const el of document.querySelectorAll('iframe[src],embed[src],object[data]')) {
      try { const u = new URL(el.getAttribute('src') || el.getAttribute('data'), location.href);
        if (u.origin === location.origin && u.pathname.startsWith('/bbcswebdav/')) { pdfUrl=u.href; break; }
      } catch {}
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({kind:'cola-scan',title:document.title,page:location.href,links:links.slice(0,300),pdfUrl}));
    return true;
  })(); true;`;
}
