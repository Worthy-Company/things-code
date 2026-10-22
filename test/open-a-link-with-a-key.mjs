#!/usr/bin/env node
/**
 * User story: as someone whose brother has texted me a link to books he's
 * passing on, I want to open it and see the books straight away, with nothing
 * to set up, so that I can look at them while I'm still in the conversation.
 *
 * Arrange: the shelf holds two fictional books. The stand-in for GitHub refuses
 * any request that doesn't carry one particular fictional key, as it would for
 * a private shelf, so the books can only appear if the page really used the key
 * it was given. The browser is fresh: nothing saved. I first visit the plain
 * address, with no key in it.
 *
 * Act: one action — open the link: the same address followed by "#key=" and the
 * fictional key, in a fresh page.
 *
 * Assert:
 *   - before the action, I am on the shelf page and neither book is shown;
 *   - right after, both books are shown;
 *   - the key is no longer in the address bar, so it is not left sitting there
 *     to be shared by accident;
 *   - the key is nowhere in the page's text;
 *   - after opening the plain address again, with no key in it, both books are
 *     still shown, so the key was kept in the browser;
 *   - REVIEW (a person decides, not this code): before the link, the page says
 *     kindly what to do, without jargon;
 *   - REVIEW: after the link, the page shows nothing about keys. The test
 *     prints the page's text each time and the questions; whoever is reviewing
 *     looks at the page and says whether it does. These don't count toward
 *     pass/fail.
 *
 * Deliberately not covered here: a wrong or expired key, a key that can only
 * read, a link opened in a browser that already holds a key (the page confirms
 * before replacing it), and making the link.
 *
 * The test only looks at what a person can see and do: it opens addresses and
 * reads the page, and never looks at where the key is kept (other than leaving
 * the browser with nothing saved).
 *
 * Usage: node things/test/open-a-link-with-a-key.mjs
 */
import { startTest } from '../../test/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';

const SHELF_PAGE_PATH = `/things/`;

// Obviously fictional, and not shaped like a real token.
const KEY = 'fictional-key-7f3k9';
const BOOK_1 = 'The Lantern Orchard';
const BOOK_2 = 'Hedgehog Hour';

async function main() {
  // Arrange: a shelf of two books, behind a stand-in that wants the key.
  const library = await startOpenLibraryStub({ books: [] });
  const t = await startTest({
    name: 'open-a-link-with-a-key',
    seed: (write) => {
      write('books.json', [
        { id: 'k4m', type: 'book', name: BOOK_1, author: 'Mira Okonkwo', isbn: '9781111111113', status: 'available' },
        { id: 'w9p', type: 'book', name: BOOK_2, author: 'Pavel Lindqvist', isbn: '9782222222224', status: 'available' }
      ]);
    },
    token: null, // a fresh browser: no key saved
    requireToken: KEY,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close]
  });
  const { page } = t;
  const SHELF = t.url(SHELF_PAGE_PATH);
  const bodyText = () => page.locator('body').innerText();
  const show = async (label, question) => {
    const text = await bodyText();
    console.log('\nREVIEW  ' + question);
    console.log('        ' + label + ':\n' + text.split('\n').map(l => '          | ' + l).join('\n') + '\n');
    return text;
  };

  // Before: the plain address, no key.
  await page.goto(SHELF, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const before = await show('The page with no key', 'Before the link, does the page say kindly what to do, without jargon?');
  const onShelfPage = (await page.getByRole('heading', { name: 'Bookshelf' }).count()) > 0;
  t.expect('before the action, I am on the shelf page', onShelfPage, page.url());
  t.expect('before the action, neither book is shown',
    onShelfPage && !before.includes(BOOK_1) && !before.includes(BOOK_2), before);

  // Act: one action — open the link, as a fresh visit.
  const LINK = SHELF + '#key=' + KEY;
  try {
    await page.goto('about:blank');
    await page.goto(LINK, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  } catch (e) {
    t.fail('could not open the link — ' + e.message);
  }

  // Assert, right after.
  const after = await show('The page after the link', 'After the link, does the page show nothing about keys?');
  const shown = after.includes(BOOK_1) && after.includes(BOOK_2);
  t.expect('right after, both books are shown', shown, after);
  t.expect('the key is no longer in the address bar', shown && !page.url().includes(KEY), page.url());
  t.expect('the key is nowhere in the page\'s text', shown && !after.includes(KEY), after);

  // Assert, opening the plain address again: the key was kept.
  await page.goto('about:blank');
  await page.goto(SHELF, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const again = await bodyText();
  t.expect('opening the plain address again, both books are still shown',
    shown && again.includes(BOOK_1) && again.includes(BOOK_2), again);

  // 2 before + 3 right after + 1 after opening the plain address again. If an earlier step threw, report
  // against 6 rather than however many ran.
  await t.finish(6, ' (REVIEW items are for a person to decide.)');
}

main();
