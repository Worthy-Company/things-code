#!/usr/bin/env node
/**
 * User story: as someone whose brother has texted me a link to books he's
 * passing on, I want to open it and see the books straight away, with nothing
 * to set up, so that I can look at them while I'm still in the conversation. I
 * have none of his other projects, and the page must not need them.
 *
 * Arrange: the shelf holds two fictional books, behind a stand-in for GitHub
 * that refuses any request without one particular fictional key. The page is
 * served from a folder that holds only the shelf's own files, the way a site
 * made from the shelf's own repository would be. The code every page shares
 * (the platform) is not in that folder: it is published on the web, so the
 * browser is told to answer requests for the platform's address from the local
 * copy, which keeps the test offline. The browser is fresh: nothing saved.
 *
 * Act: one action — open the shelf's address followed by "#key=" and the
 * fictional key.
 *
 * Assert:
 *   - both books are shown;
 *   - the key is no longer in the address bar;
 *   - nothing the page asked its own site for was missing;
 *   - the page fetched the shared code from the platform's address, which
 *     shows it really uses it;
 *   - REVIEW (a person decides, not this code): the page looks finished, not
 *     bare, with its colours and layout. The test prints the page's text and
 *     the question; it doesn't count toward pass/fail.
 *
 * Deliberately not covered here: a wrong or expired key (see
 * open-a-link-with-a-key.mjs), and the real site (the test never goes online).
 * The local copy of the platform is found through support/where.mjs.
 *
 * The test only looks at what a person can see and do, plus what the page
 * asks for.
 *
 * Usage: node things/test/open-the-shelf-on-its-own.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER as SHELF_FOLDER, PLATFORM_FOLDER } from './support/where.mjs';

const PLATFORM_ADDRESS = 'https://platform.worthycompany.org/';

// Obviously fictional, and not shaped like a real token.
const KEY = 'fictional-key-7f3k9';
const BOOK_1 = 'The Lantern Orchard';
const BOOK_2 = 'Hedgehog Hour';

// The site as a visitor would get it: the shelf's own page files and nothing else.
function buildSite() {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-site-'));
  for (const file of ['index.html', 'shelf.js', 'shelf.css', 'favicon.svg']) {
    fs.copyFileSync(path.join(SHELF_FOLDER, file), path.join(site, file));
  }
  return site;
}

async function main() {
  // Arrange: a shelf of two books, behind a stand-in that wants the key; a site with nothing else around it.
  const site = buildSite();
  const library = await startOpenLibraryStub({ books: [] });
  const t = await startTest({
    name: 'open-the-shelf-on-its-own',
    seed: (write) => {
      write('books.json', [
        { id: 'k4m', type: 'book', name: BOOK_1, author: 'Mira Okonkwo', isbn: '9781111111113', status: 'available' },
        { id: 'w9p', type: 'book', name: BOOK_2, author: 'Pavel Lindqvist', isbn: '9782222222224', status: 'available' }
      ]);
    },
    token: null, // a fresh browser: no key saved
    requireToken: KEY,
    appDir: site,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close, () => fs.rmSync(site, { recursive: true, force: true })]
  });
  const { page } = t;

  // The platform is published on the web; answer its address from the local copy.
  const fromPlatform = [];
  await page.route(PLATFORM_ADDRESS + '**', async (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    const filePath = path.join(PLATFORM_FOLDER, file);
    if (!fs.existsSync(filePath)) return route.fulfill({ status: 404, body: 'Not found' });
    fromPlatform.push(file);
    const type = file.endsWith('.css') ? 'text/css' : 'text/javascript';
    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(filePath) });
  });

  // What the site could not supply: any request to the site itself that came back "not found".
  const missing = [];
  page.on('response', (res) => {
    if (res.status() === 404 && res.url().startsWith(t.url('/'))) missing.push(res.url());
  });

  // Act: one action — open the link, as a fresh visit.
  try {
    await page.goto(t.url('/') + '#key=' + KEY, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  } catch (e) {
    t.fail('could not open the link — ' + e.message);
  }

  // Assert.
  const text = await page.locator('body').innerText();
  console.log('\nREVIEW  Does the page look finished, with its colours and layout, and not bare?');
  console.log('        The page after the link:\n' + text.split('\n').map(l => '          | ' + l).join('\n') + '\n');
  const shown = text.includes(BOOK_1) && text.includes(BOOK_2);
  t.expect('both books are shown', shown, text);
  t.expect('the key is no longer in the address bar', shown && !page.url().includes(KEY), page.url());
  t.expect('nothing the page asked its own site for was missing', missing.length === 0, missing.join(', '));
  t.expect('the shared code came from the platform\'s address',
    ['js/github.js', 'js/format.js', 'css/theme.css'].every(f => fromPlatform.includes(f)), fromPlatform.join(', ') || 'nothing was fetched from it');

  await t.finish(4, ' (REVIEW items are for a person to decide.)');
}

main();
