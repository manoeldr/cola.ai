function classifyBlackboardLink(href, label) {
  const url = new URL(href);
  const file = /\.(pdf|docx?|pptx?|xlsx?|txt|zip|csv)(?:$|[?#])/i;
  if (/\/ultra\/courses\/[^/]+\/file\/[^/]+/i.test(url.pathname) ||
      file.test(url.href) || file.test(label) ||
      /(?:\/bbcswebdav\/|\/attachments\/|\/resource\/|\/files\/)/i.test(url.pathname)) return 'possivel-arquivo';
  if (/\/ultra\/courses\/[^/]+\/assessment\//i.test(url.pathname)) return 'avaliacao';
  if (/^\/ultra\/courses\/[^/]+\/outline\/?$/i.test(url.pathname)) return 'disciplina';
  if (/\/ultra\/courses\/[^/]+/i.test(url.pathname)) return 'navegacao-do-curso';
  return 'outro-link';
}

// Executed only after a click; no API, cookies, storage or network access.
function extractBlackboard() {
  // Classifier is included directly below for executeScript serialization.
  const classify = function classifyBlackboardLink(href, label) {
  const url = new URL(href);
  const file = /\.(pdf|docx?|pptx?|xlsx?|txt|zip|csv)(?:$|[?#])/i;
  if (/\/ultra\/courses\/[^/]+\/file\/[^/]+/i.test(url.pathname) ||
      file.test(url.href) || file.test(label) ||
      /(?:\/bbcswebdav\/|\/attachments\/|\/resource\/|\/files\/)/i.test(url.pathname)) return 'possivel-arquivo';
  if (/\/ultra\/courses\/[^/]+\/assessment\//i.test(url.pathname)) return 'avaliacao';
  if (/^\/ultra\/courses\/[^/]+\/outline\/?$/i.test(url.pathname)) return 'disciplina';
  if (/\/ultra\/courses\/[^/]+/i.test(url.pathname)) return 'navegacao-do-curso';
  return 'outro-link';
};
  const clean = value => (value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const roots = [document];
  const diagnostics = { accessibleFrames: 0, inaccessibleFrames: 0, openShadowRoots: 0 };
  // Include same-origin embedded documents and open shadow DOM only.
  for (let i = 0; i < roots.length && i < 200; i++) {
    for (const el of roots[i].querySelectorAll('*')) {
      if (el.shadowRoot) { roots.push(el.shadowRoot); diagnostics.openShadowRoots++; }
      if (el.tagName === 'IFRAME') {
        try {
          if (el.contentDocument) { roots.push(el.contentDocument); diagnostics.accessibleFrames++; }
          else diagnostics.inaccessibleFrames++;
        } catch { diagnostics.inaccessibleFrames++; }
      }
    }
  }
  const seen = new Set();
  const links = [], headings = [], embeddedResources = [];
  const visible = el => {
    const view = el.ownerDocument.defaultView;
    const s = view.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
  };
  for (const root of roots) {
    for (const el of root.querySelectorAll('iframe[src],embed[src],object[data]')) {
      const raw = el.getAttribute('src') || el.getAttribute('data');
      try {
        const url = new URL(raw, el.ownerDocument.baseURI);
        if (!['http:', 'https:', 'blob:'].includes(url.protocol)) continue;
        embeddedResources.push({ tag: el.tagName.toLowerCase(), title: clean(el.getAttribute('title')), url: url.href });
      } catch { /* Ignore invalid resource URLs. */ }
    }
    for (const el of root.querySelectorAll('h1,h2,h3,[role="heading"]')) {
      const text = clean(el.textContent);
      if (text && visible(el) && !headings.includes(text)) headings.push(text);
    }
    for (const el of root.querySelectorAll('a[href]')) {
      if (!visible(el)) continue;
      let url;
      try { url = new URL(el.getAttribute('href'), el.ownerDocument.baseURI); } catch { continue; }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      const label = clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title'));
      if (!label || seen.has(url.href)) continue;
      seen.add(url.href);
      links.push({ label, url: url.href, type: classify(url.href, label) });
    }
  }
  return {
    schemaVersion: 2, capturedAt: new Date().toISOString(),
    page: { title: document.title, url: location.href },
    embeddedResources: embeddedResources.slice(0, 50),
    headings: headings.slice(0, 100), links: links.slice(0, 500), diagnostics,
    limitations: ['Somente elementos visíveis e carregados.', 'Links são candidatos; conteúdo e download não foram verificados.', 'Pastas fechadas, listas virtualizadas e frames de outra origem podem não ser lidos.']
  };
}
