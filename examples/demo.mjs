import { BookReader, createHtmlSource, createImageSource, createPdfSource } from '/dist/index.js';
import labels from '/dist/locales/en.json' with { type: 'json' };
const params = new URLSearchParams(location.search);
const controller = new AbortController();
let source;
if (params.get('source') === 'pdf') {
  // PDF.js is provided by the demo runner, never bundled in the reader package.
  const pdfjs = await import('/pdfjs/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
  source = await createPdfSource(pdfjs.getDocument({ url: '/sample.pdf' }), controller.signal);
} else if (params.get('source') === 'images') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="Canvas"/><text x="80" y="150" fill="CanvasText">${labels.reader}</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  source = createImageSource(Array.from({ length: 7 }, () => ({ src: url })), { width: 600, height: 800 });
  source.destroy = () => URL.revokeObjectURL(url);
} else {
  source = createHtmlSource(Array.from({ length: 9 }, (_, index) => () => {
    const page = document.createElement('div'); page.className = 'demo-paper';
    const title = document.createElement('h1'); title.textContent = labels.reader;
    const block = document.createElement('div'); block.className = 'demo-block'; block.textContent = String(index + 1);
    const paragraph = document.createElement('p'); paragraph.textContent = labels.page.replace('{page}', String(index + 1));
    page.append(title, block, paragraph); return page;
  }), { width: 600, height: 800 });
}
const reader = new BookReader(document.querySelector('#reader'), source, {
  title: labels.reader, direction: params.get('rtl') ? 'rtl' : 'ltr',
  animationDuration: 400, autoTurnSeconds: 1,
  onStateChange: state => { window.readerState = state; },
});
window.bookReader = reader; window.bookSource = source;
window.addEventListener('pagehide', () => { controller.abort(); reader.destroy(); void source.destroy?.(); }, { once: true });
