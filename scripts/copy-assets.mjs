import { copyFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/locales/', root), { recursive: true });
await copyFile(new URL('src/styles.css', root), new URL('dist/styles.css', root));
await copyFile(new URL('src/locales/en.json', root), new URL('dist/locales/en.json', root));
