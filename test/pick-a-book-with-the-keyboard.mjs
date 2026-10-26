#!/usr/bin/env node
/**
 * User story: as someone clearing out books, I type part of a title and want to
 * pick the book I mean with the down arrow and Enter, so that I can add books
 * without reaching for the mouse.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library knows two fictional books whose titles contain
 * "wandering moon". I am signed in with a token, so I can add books. The page
 * is open, and "wandering moon" has been typed into the box for adding a book,
 * so both are offered, "The Wandering Moon" first.
 *
 * Act: one gesture. Press the down arrow once, and then Enter.
 *
 * Assert:
 *   - before, the book is not on the shelf;
 *   - after, the shelf shows "The Wandering Moon";
 *   - the other match, "Wandering Moon Lullabies", is nowhere on the page.
 *
 * Deliberately not covered here: the keys themselves (the shared picker's own
 * tests in the platform cover moving, Enter and Escape), and everything about
 * adding a book (add-a-book-by-title.mjs). This only checks that the shelf
 * uses the picker.
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node things/test/pick-a-book-with-the-keyboard.mjs
 */
import { startTest } from '../../../platform/test/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const BOOK = 'The Wandering Moon';
const OTHER_BOOK = 'Wandering Moon Lullabies';

// Fictional books, in the shape Open Library uses. The ISBNs are made up (valid check digits).
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000001W', title: BOOK, author_name: ['Ilsa Brightwater'], cover_i: 9100001,
    isbn: ['9781234567897'], first_publish_year: 2001 },
  { key: '/works/OL9000002W', title: OTHER_BOOK, author_name: ['Tobias Quill'], cover_i: 9100002,
    isbn: ['9780987654328'], first_publish_year: 1998 }
];

async function main() {
  // Arrange: an empty shelf, an Open Library that knows two books, and the title typed.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'pick-a-book-with-the-keyboard',
    seed: (write) => { write('books.json', []); },
    appDir: THINGS_FOLDER,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close]
  });
  const { page } = t;
  const addBox = page.getByLabel('Add a book');
  const bookText = () => page.locator('body').innerText();

  await page.goto(t.url('/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await addBox.fill('wandering moon');
  await page.getByText(BOOK, { exact: false }).first().waitFor();
  t.expect('before the action, the book is not on the shelf', !(await page.locator('.shelf').innerText().catch(() => '')).includes(BOOK));

  // Act: one gesture. Down, Enter.
  try {
    await addBox.press('ArrowDown');
    await addBox.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  } catch (e) {
    t.fail('could not pick a book with the keyboard — ' + e.message);
  }

  // Assert.
  const text = await bookText();
  const onShelf = (await page.locator('.shelf').innerText().catch(() => '')).includes(BOOK);
  t.expect('right after, the shelf shows the book', onShelf, text);
  t.expect('the other match is nowhere on the page', onShelf && !text.includes(OTHER_BOOK), text);
  t.expect('no unexpected page or console errors occurred', t.pageErrors.length === 0, t.pageErrors.join('\n'));

  // 1 before + 3 after. If an earlier step threw, report against 4.
  await t.finish(4);
}

main();
