import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.BOOK_READER_PORT ?? 3072);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.pdf': 'application/pdf' };
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    let file = resolve(root, path === '/' ? 'examples/index.html' : `.${path}`);
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    if (path.startsWith('/pdfjs/') && process.env.BOOK_READER_PDFJS_DIR) {
      const pdfRoot = resolve(process.env.BOOK_READER_PDFJS_DIR);
      file = resolve(pdfRoot, path.slice('/pdfjs/'.length));
      if (!file.startsWith(pdfRoot + sep)) throw new Error('Invalid path');
    }
    if (path === '/sample.pdf' && process.env.BOOK_READER_SAMPLE_PDF) file = resolve(process.env.BOOK_READER_SAMPLE_PDF);
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, '127.0.0.1', () => process.stdout.write(`Book reader demo listening on port ${port}\n`));
