# @infinitie/book-reader

A reusable TypeScript reader for newspapers, magazines and other books. It provides
animated page turns, responsive one/two-page layouts, zoom, thumbnails, fullscreen
and automatic page turning.

The image/HTML reader and animation have **no runtime dependencies**. React is an
optional peer dependency. PDFs require PDF.js, supplied by the consuming app; PDF.js
is not included in this package.

## 1. Set up this repository

Use Node.js 20.10 or newer. Run these commands from the folder containing this
README and `package.json`:

```sh
npm install
npm run build
npm test
npm run demo
```

Open `http://127.0.0.1:3072` for the HTML demo. Other demo modes:

- `http://127.0.0.1:3072/?source=images` — image pages.
- `http://127.0.0.1:3072/?rtl=1` — right-to-left navigation.

Override the demo port with `BOOK_READER_PORT`. The generated `dist/` folder is
excluded from Git and recreated by `npm run build`.

## 2. Install it in another project

This package is not published to the npm registry. Create a local package archive
from this repository:

```sh
npm pack
```

This builds the package and produces `infinitie-book-reader-0.2.0.tgz`. In your
application folder, install that archive using its actual location:

```sh
npm install /absolute/path/to/infinitie-book-reader-0.2.0.tgz
```

The following examples assume a browser application with a bundler, such as Next.js
or Vite. Always import the stylesheet and give the reader host an explicit height.

## 3. Image reader: JavaScript / TypeScript

Provide your own page images at the paths below. `width` and `height` describe the
intrinsic size/aspect ratio of one page; the reader fits it to the available screen.

```html
<div id="book" style="height: 90dvh;"></div>
```

```ts
import { BookReader, createImageSource } from '@infinitie/book-reader';
import '@infinitie/book-reader/styles.css';

const host = document.querySelector<HTMLElement>('#book');
if (!host) throw new Error('Book host element is missing');

const source = createImageSource([
  { src: '/editions/page-1.jpg', alt: 'Front page' },
  { src: '/editions/page-2.jpg', alt: 'Second page' },
], { width: 600, height: 800 });

const reader = new BookReader(host, source, {
  title: 'Daily edition',
  autoTurnSeconds: 30,
  onError: error => console.error('Reader failed', error),
});

// Automatic turning is off initially. Enable it when needed:
reader.setAutoTurn(true, 30);

// When your modal closes or the page unmounts:
async function closeReader() {
  reader.destroy();
  await source.destroy?.();
}
```

Use localized values for titles and image descriptions in your application.
HTTP(S), relative and blob image URLs are supported. Pages load on demand; failed
or timed-out pages offer retry.

## 4. React / Next.js

Install React in the consuming application if it is not already present. The React
adapter creates the reader after mounting and releases both reader and source on
unmount. Keep `createSource` and `options` stable to avoid reopening the book.

```tsx
'use client';

import { useCallback, useMemo } from 'react';
import { createImageSource, type ReaderOptions } from '@infinitie/book-reader';
import { ReactBookReader } from '@infinitie/book-reader/react';
import '@infinitie/book-reader/styles.css';

export default function EditionReader() {
  const createSource = useCallback(() => createImageSource([
    { src: '/editions/page-1.jpg' },
    { src: '/editions/page-2.jpg' },
  ], { width: 600, height: 800 }), []);

  const options = useMemo<ReaderOptions>(() => ({
    title: 'Daily edition',
    autoTurnSeconds: 30,
  }), []);

  return <ReactBookReader
    className="book-reader-mount"
    createSource={createSource}
    options={options}
  />;
}
```

Add this to the application's CSS. The second rule sizes the adapter's inner host:

```css
.book-reader-mount { height: 90dvh; }
.book-reader-mount > div:last-child { height: 100%; }
```

For Next.js, keep edition text and metadata in Server Components. Open/lazy-load
this client reader when a user selects an edition. The package does not fetch your
Laravel APIs or supply article metadata.

## 5. PDF setup (optional)

Install PDF.js in the consuming application:

```sh
npm install pdfjs-dist
mkdir -p public
cp node_modules/pdfjs-dist/build/pdf.worker.mjs public/pdf.worker.mjs
```

Serve that worker file as a static asset. Copy it again whenever PDF.js changes:
the worker and library versions must match. The adapter was tested with PDF.js
6.4.299.

For the React example above, replace its `createSource` with this stable factory:

```tsx
import { createPdfSource } from '@infinitie/book-reader';

const createSource = useCallback(async (signal: AbortSignal) => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
  return createPdfSource(
    pdfjs.getDocument({ url: '/editions/daily.pdf' }),
    signal,
  );
}, []);
```

Provide your actual PDF URL. Cross-origin PDF servers must allow CORS. If your app
already has the bytes, use `pdfjs.getDocument({ data: pdfBytes })` instead. The reader
uses the PDF's actual page count and dimensions, then renders pages on demand.

To run the repository's PDF demo with local assets:

```sh
BOOK_READER_PDFJS_DIR=/absolute/path/to/node_modules/pdfjs-dist \
BOOK_READER_SAMPLE_PDF=/absolute/path/to/edition.pdf \
npm run demo
```

Open `http://127.0.0.1:3072/?source=pdf`. These paths are demo inputs; PDF.js and the
sample document are not bundled into the reader package.

## 6. Static HTML and custom sources

```ts
import { createHtmlSource } from '@infinitie/book-reader';

const source = createHtmlSource([
  () => {
    const page = document.createElement('article');
    const heading = document.createElement('h1');
    heading.textContent = 'Your edition title';
    page.append(heading);
    return page;
  },
], { width: 600, height: 800 });
```

HTML pages are trusted, static content laid out at the supplied intrinsic size.
Never pass unsanitized API HTML. Content is cloned for rendering/animation, so
listeners attached to individual page elements are not retained.

For another source type, implement the exported `PageSource` interface.
`renderPage(index, container, options)` uses zero-based indices, must render only
into the supplied container, and must respect `options.signal`.

## Controls and options

The toolbar includes navigation, page jump, zoom/fit, thumbnails, fullscreen and
auto-turn controls. Keyboard arrows/Home/End, swipe, pinch and Ctrl/Command-wheel
zoom are supported. RTL reverses navigation and animation.

| Option | Default / purpose |
| --- | --- |
| `title` | Optional reader title |
| `initialPage` | `0`; zero-based page index |
| `spreadBreakpoint` | `760`; viewport width for two-page mode |
| `animationDuration` | `350`; milliseconds per full page turn |
| `reducedMotion` | Uses the system preference when omitted |
| `autoTurnSeconds` | `5`; interval from 1 to 3600 seconds; initially off |
| `language` / `direction` | `en` / `ltr`; use `rtl` when needed |
| `labels` | Partial translated labels; missing/blank values use English |
| `downloadUrl` / `shareUrl` | Enable download/share actions |
| `onClose` | Enable the close button; app owns modal closure |
| `onStateChange` / `onError` | Receive state updates / rendering errors |
| `onDownload` / `onShare` | Override those actions with app callbacks |

For plain JavaScript consumers, the public API is:

```ts
await reader.next();
await reader.previous();
await reader.goTo(4); // fifth page; desktop mode uses its containing spread
reader.setZoom(1.5); // valid range: 1 to 3
reader.setAutoTurn(true, 60); // one turn per minute
reader.setAutoTurn(false);
const state = reader.state;
reader.destroy();
```

Plain JS consumers own source disposal separately; `ReactBookReader` disposes its
source automatically. Auto-turn pauses while rendering, interacting, zoomed or in
a hidden tab, and stops at the final page.

## Themes and translations

Fonts are inherited from the host application. The reader uses News Hunt theme
variables when available and system light/dark colors otherwise. Independent apps
can customize these CSS variables on the reader or an ancestor:

```css
.book-reader-mount {
  --book-reader-surface: var(--app-surface);
  --book-reader-text: var(--app-text);
  --book-reader-muted: var(--app-muted);
  --book-reader-border: var(--app-border);
  --book-reader-accent: var(--app-primary);
  --book-reader-paper: var(--app-paper);
}
```

Define those `--app-*` tokens in your application's theme. PDF/image pixels retain
their original colors. English labels live in `src/locales/en.json`. Supply your
translated equivalents through `options.labels`, alongside `language` and
`direction`. The News Hunt host also keeps its translations under `bookReader` in
its own `languages/en.json`; that file is not required by this standalone repository.

## Performance and current limits

- Six cached page entries; adjacent spreads are prepared in the background at normal zoom. PDF canvases are capped at four million pixels each.
- Thumbnail windows contain up to 24 pages with two concurrent preview renders;
  offscreen previews are discarded.
- Closing/resize cancels obsolete work. A PDF starts loading when its source is created.
- Version 0.2 follows top/bottom corner dragging with a clipped, reflected fold and moving shadows. This is a paper-fold illusion, not a physical paper mesh simulation.
- Zoom retains the current readable spread while sharper pages render offscreen; stale zoom results are discarded. The host can size PDF canvases to their page containers for immediate visual scaling.
- Page turns animate immediately while uncached destination pages load. Current pages stay visible during the turn; one pending navigation request is retained for rapid input.
- Partial slow drags snap back; corner clicks and sufficient drags complete the turn. Corner grab areas include up to 24 pixels around the outer edge, scaled down for small pages.
- PDFs render to canvas. Selectable/searchable PDF text, annotations, printing and
  DRM are not implemented.
- Browsers must support ResizeObserver, Pointer Events, requestAnimationFrame, CSS clip-path and
  JavaScript modules. Fullscreen/share availability depends on the browser/context.

## Tests and packaging

```sh
npm test
npm pack --dry-run
```

Optional browser checks use an existing Playwright installation and a running demo:

```sh
BOOK_READER_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BOOK_READER_DEMO_URL=http://127.0.0.1:3072 \
npm run test:browser
```

Add `BOOK_READER_TEST_PDF=1` when the demo has PDF.js and a sample PDF configured.
Use the same environment variables with `node tests/zoom.browser.mjs` to check slow zoom rendering, repeated zoom and disposal.
The browser suite also verifies all four directional corner folds, pinch zoom, slow-source animation, bounded preloading, resize cancellation and disposal.

Version 0.2 includes a `prepare` build script for installing directly from a Git commit after uploading the source. Pin the commit in your consuming app to make installs reproducible.

The package is currently `private` and `UNLICENSED`. Git upload does not publish it
to npm. Before public distribution, choose a license; before npm publishing, also
remove `private` and add the repository metadata. Do not commit `node_modules/`,
`dist/` or `*.tgz`; `.gitignore` already excludes them.
