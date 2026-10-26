#!/usr/bin/env node
/**
 * Local stand-in for Open Library's book search and cover pictures, so a test
 * never touches the real network and never depends on what the real database
 * holds today. Point a page at it with window.OPEN_LIBRARY_BASE and
 * window.OPEN_LIBRARY_COVERS_BASE (the same pattern as window.GH_API_BASE in
 * js/github.js). Test tooling only; it does not ship as part of the app.
 *
 * It answers GET /search.json?q=... with the books it was given whose title or
 * author contains every word of the query (or ?title=..., whose title alone does), in the shape Open Library uses
 * ({ numFound, docs: [{ key, title, author_name, isbn, cover_i, ... }] }), and
 * any GET /b/... with a one-pixel picture, so a cover counts as loaded.
 *
 * Programmatic usage: import { startOpenLibraryStub } from './support/open-library-stub-server.mjs'
 * (it lives in support/ so the test runner, which runs every file directly in test/, skips it)
 */
import http from 'node:http';

// A one-pixel PNG.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64');

/**
 * Start the stand-in on a free port. `books` are search results in Open
 * Library's shape. Returns { server, port, url, close() }.
 */
export function startOpenLibraryStub({ books = [], delayMs = 0 }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (url.pathname === '/search.json') {
      // Like Open Library: q looks at the title and the author together, title looks at the title only.
      // Results keep the order the books were given in, which stands for Open Library's own ranking.
      const titleOnly = !url.searchParams.get('q') && url.searchParams.get('title');
      const words = (url.searchParams.get('q') || url.searchParams.get('title') || '')
        .toLowerCase().split(/\s+/).filter(Boolean);
      const docs = books.filter(b => {
        const hay = (titleOnly ? [b.title] : [b.title, ...(b.author_name || [])]).join(' ').toLowerCase();
        return words.every(w => hay.includes(w));
      });
      const json = JSON.stringify({ numFound: docs.length, start: 0, docs });
      // `delayMs` makes the stand-in slow to answer, as the real one sometimes is.
      return setTimeout(() => {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
        res.end(json);
      }, delayMs);
    }

    if (url.pathname.startsWith('/b/')) {
      res.writeHead(200, { ...cors, 'Content-Type': 'image/png', 'Content-Length': PIXEL.length });
      return res.end(PIXEL);
    }

    res.writeHead(404, cors);
    res.end('Not found (Open Library stand-in)');
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://localhost:${port}`, close: () => new Promise(r => server.close(r)) });
    });
  });
}
