#!/usr/bin/env node
/**
 * User story: as someone adding a book I'm holding, when several matches have
 * almost the same title, I want to see each match's ISBN, so that I can tell
 * which edition is mine and pick the right one.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library, the open book database, knows one fictional book
 * that lists two ISBNs, a 10-digit one first and a 13-digit one after it. I am
 * signed in with a token. The page is open.
 *
 * Act: one action — type the book's title into the box for adding a book.
 *
 * Assert:
 *   - before the action, no matches are shown;
 *   - right after, the first match shows the 13-digit ISBN, the one that would
 *     be saved with the book;
 *   - it does not show the 10-digit one.
 *
 * Deliberately not covered here: choosing between editions (a backlog item),
 * how the ISBN looks (REVIEW below), and adding the book (add-a-book-by-title).
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node test/see-the-isbn-in-the-results.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const BOOK = 'The Copper Kettle Atlas';
const TEN_DIGIT = '0123456789';
const THIRTEEN_DIGIT = '9781234567897';

// A fictional book in the shape Open Library uses. Both ISBNs are made up.
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000021W', title: BOOK, author_name: ['Ilsa Brightwater'], cover_i: 9100021,
    isbn: [TEN_DIGIT, THIRTEEN_DIGIT], first_publish_year: 1999 }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library that knows one book with two ISBNs.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'see-the-isbn-in-the-results',
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
  console.log('\nREVIEW  Does the ISBN read quietly, as a detail and not as the main thing?');
  t.expect('the first match shows the 13-digit ISBN', first.includes(THIRTEEN_DIGIT), first);
  t.expect('it does not show the 10-digit one', !first.includes(TEN_DIGIT), first);

  // 1 before + 2 after. If an earlier step threw, report against 3.
  await t.finish(3, ' (REVIEW items are for a person to decide.)');
}

main();
