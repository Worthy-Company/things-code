#!/usr/bin/env node
/**
 * User story: as someone cataloguing a book I'm holding, I type its title and
 * the last digits of the ISBN on its back cover, and I want the list to show the
 * edition ending in those digits, so that I add exactly my copy without any extra
 * steps.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library, the open book database, knows one fictional book
 * with three editions, whose ISBNs end in 0013, 4004 and 3335. Its best-matching
 * edition, the usual guess, is the one ending in 0013. I am signed in with a
 * token. The page is open.
 *
 * Act: one action — type the title followed by the last digits of my copy's
 * ISBN: "amber compass atlas 3335".
 *
 * Assert:
 *   - before the action, no matches are shown;
 *   - right after, the first match is the book, showing the ISBN ending in 3335
 *     and not the one ending in 0013;
 *   - REVIEW (a person decides, not this code): the last four digits are set
 *     apart (bold) so they can be compared with the book in hand at a glance.
 *
 * Deliberately not covered here: the usual guess when no digits are typed
 * (see-the-isbn-in-the-results.mjs and the-isbn-of-the-edition-i-hold.mjs),
 * digits that match no edition, and adding the book.
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node test/the-edition-ending-in-these-digits.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const TITLE = 'Amber Compass Atlas';
const GUESS = '9780000000013';
const OTHER = '9780000004004';
const MINE = '9780000003335';

// A fictional book in the shape Open Library uses: the work's ISBNs, and its best-matching edition.
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000041W', title: TITLE, author_name: ['Pavel Lindqvist'], cover_i: 9100041,
    isbn: [GUESS, OTHER, MINE],
    editions: { numFound: 1, start: 0, docs: [{ isbn: [GUESS] }] } }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library with one book of three editions.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'the-edition-ending-in-these-digits',
    seed: (write) => { write('books.json', []); },
    appDir: THINGS_FOLDER,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close]
  });
  const { page } = t;
  const addBox = page.getByLabel('Add a book');
  const matches = () => page.getByRole('listitem');

  await page.goto(t.url('/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  t.expect('before the action, no matches are shown', (await matches().count()) === 0);

  // Act: one action — the title, then the last digits.
  try {
    await addBox.fill(TITLE.toLowerCase() + ' 3335');
    await matches().first().waitFor();
  } catch (e) {
    t.fail('no matches appeared for the title and digits — ' + e.message);
  }

  // Assert.
  const first = (await matches().count()) ? await matches().first().innerText() : '';
  console.log('\nThe first match:\n  ' + first.replace(/\n/g, '\n  '));
  console.log('\nREVIEW  Are the last four digits set apart (bold), so they can be compared with the book in hand?');
  t.expect('the first match is the book, showing the ISBN ending in 3335',
    first.includes(TITLE) && first.includes(MINE), first);
  t.expect('it does not show the usual guess, ending in 0013', !first.includes(GUESS), first);

  // 1 before + 2 after. If an earlier step threw, report against 3.
  await t.finish(3, ' (REVIEW items are for a person to decide.)');
}

main();
