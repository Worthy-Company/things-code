#!/usr/bin/env node
/**
 * User story: as someone adding a book I'm holding, I want the ISBN offered to
 * be that of the common printed edition, so that the cover and details match my
 * copy and not some other edition of the same book.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library, the open book database, knows one fictional book.
 * Its list of ISBNs for the whole work starts with an unusual one (9781111111113,
 * a digital edition); the edition that best matches the search, the ordinary
 * printed one, has 9782222222224. I am signed in with a token. The page is open.
 *
 * Act: one action — type the book's title into the box for adding a book.
 *
 * Assert:
 *   - before the action, no matches are shown;
 *   - right after, the first match shows the printed edition's ISBN, 9782222222224;
 *   - it does not show the unusual one, 9781111111113.
 *
 * Deliberately not covered here: listing every ISBN to confirm one, finding a
 * book by a few of its digits (both are ideas in the backlog), and adding the
 * book (add-a-book-by-title.mjs).
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node test/the-isbn-of-the-edition-i-hold.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const BOOK = 'The Silver Thimble Chronicle';
const UNUSUAL = '9781111111113';
const PRINTED = '9782222222224';

// A fictional book in the shape Open Library uses: the whole work's ISBNs, and the editions that best
// match the search, each with its own. All ISBNs are made up (valid check digits).
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000031W', title: BOOK, author_name: ['Mira Okonkwo'], cover_i: 9100031,
    isbn: [UNUSUAL, '9783333333335', PRINTED],
    editions: { numFound: 1, start: 0, docs: [{ isbn: [PRINTED, '2222222224'] }] } }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library whose work-wide list starts with the unusual ISBN.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'the-isbn-of-the-edition-i-hold',
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

  // Act: one action — type the title.
  try {
    await addBox.fill(BOOK);
    await matches().first().waitFor();
  } catch (e) {
    t.fail('no matches appeared for the title — ' + e.message);
  }

  // Assert.
  const first = (await matches().count()) ? await matches().first().innerText() : '';
  console.log('\nThe first match:\n  ' + first.replace(/\n/g, '\n  '));
  t.expect('the first match shows the printed edition\'s ISBN', first.includes(PRINTED), first);
  t.expect('it does not show the unusual one', !first.includes(UNUSUAL), first);

  // 1 before + 2 after. If an earlier step threw, report against 3.
  await t.finish(3);
}

main();
