#!/usr/bin/env node
/**
 * User story: as someone cataloguing the books I'm giving away, I type part of
 * a title and want the book I mean to be first in the list of matches, so that
 * I add the right one quickly and without scrolling.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's
 * data). A stand-in for Open Library, the open book database, knows two
 * fictional books. One is a well-known book that Open Library's general search
 * puts first for the words I'll type, because those words also appear in its
 * author's name. The other is the book I mean, whose title is exactly those
 * words. I am signed in with a token, so I can add books. The page is open.
 *
 * Act: one action — type the book's title, "Marigold's Story Collection", into
 * the box for adding a book.
 *
 * Assert:
 *   - before the action, I am on the shelf (the box for adding a book is
 *     there) and no matches are shown;
 *   - right after, matches are shown, and the first one is "Marigold's Story
 *     Collection".
 *
 * Deliberately not covered here: choosing a match (see add-a-book-by-title),
 * a title typed only in part, a search that finds nothing, and the exact
 * edition on the shelf.
 *
 * The test only looks at what a person can see and do: it finds the box by its
 * visible label and the matches as a list on the page.
 *
 * Usage: node things/test/the-book-i-mean-comes-first.mjs
 */
import { startTest } from '../../../platform/test/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const SHELF_PAGE_PATH = `/`;

const WELL_KNOWN_BOOK = 'The Garden Almanac of Marigold Lane';
const BOOK = 'Marigold\'s Story Collection';

// Fictional books in the shape Open Library uses. The well-known one is listed
// first, as the general search would rank it: all the typed words appear
// across its title and its author's name. The ISBNs are made up (valid check
// digits).
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000011W', title: WELL_KNOWN_BOOK, author_name: ['Marigold\'s Story Collection Society'],
    cover_i: 9100011, isbn: ['9781234567897'], first_publish_year: 1962 },
  { key: '/works/OL9000012W', title: BOOK, author_name: ['Ilsa Brightwater'],
    cover_i: 9100012, isbn: ['9780987654328'], first_publish_year: 2004 }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library that ranks the wrong book first for a general search.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'the-book-i-mean-comes-first',
    seed: (write) => { write('books.json', []); },
    appDir: THINGS_FOLDER,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close]
  });
  const { page } = t;

  const addBox = () => page.getByLabel('Add a book');
  const matches = () => page.getByRole('listitem');

  await page.goto(t.url(SHELF_PAGE_PATH), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const onShelf = (await addBox().count()) > 0;
  t.expect('before the action, I am on the shelf, with a box for adding a book', onShelf, page.url());
  t.expect('before the action, no matches are shown', onShelf && (await matches().count()) === 0);

  // Act: one action — type the title.
  try {
    await addBox().fill(BOOK);
    await page.waitForLoadState('networkidle');
    await matches().first().waitFor();
  } catch (e) {
    t.fail('no matches appeared for the title — ' + e.message);
  }

  // Assert, right after the action.
  const count = await matches().count();
  const first = count ? await matches().first().innerText() : '';
  console.log('\nThe matches, in order:');
  for (let i = 0; i < count; i++) console.log('  ' + (i + 1) + '. ' + (await matches().nth(i).innerText()).replace(/\n/g, ' — '));
  t.expect('right after, matches are shown', count > 0);
  // A match reads title first, then author, so the title is its first line.
  t.expect('the first match is the book I typed', count > 0 && first.split('\n')[0].trim() === BOOK, first);

  // 2 before + 2 right after. If an earlier step threw, report against 4 rather than however many ran.
  await t.finish(4);
}

main();
