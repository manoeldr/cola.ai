import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
export async function extractPages(bytes, progress = () => {}, signal) {
  const task = pdfjs.getDocument({data:bytes, isEvalSupported:false, useSystemFonts:true, disableFontFace:true});
  const abort = () => { task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', abort, {once:true});
  try {
    if(signal?.aborted)throw new Error('Extração cancelada.');
    const doc = await task.promise;
    if (doc.numPages > 500) throw new Error('Limite deste teste: 500 páginas.');
    const pages = [];
    for (let number=1;number<=doc.numPages;number++) {
      if(signal?.aborted)throw new Error('Extração cancelada.');
      progress(number, doc.numPages);
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').replace(/ +\n/g,'\n').trim();
      pages.push({page:number, text, needsOcr:!text.trim()});
      page.cleanup();
    }
    return pages;
  } finally { signal?.removeEventListener('abort', abort); await task.destroy(); }
}
