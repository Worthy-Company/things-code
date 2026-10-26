#!/usr/bin/env node
/**
 * User story: as someone clearing out books I no longer need, I want to add a
 * book by typing part of its title and choosing it from matches with covers,
 * so that I can build up a shelf to share with someone I trust, without
 * retyping details and without asking an AI.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's
 * data). A stand-in for Open Library, the open book database, knows two
 * fictional books whose titles contain "wandering moon". I am signed in with a
 * token, so I can add books. The page is open.
 *
 * Act: one action — type "wandering moon" into the box for adding a book, and
 * choose the first match, "The Wandering Moon".
 *
 * Assert:
 *   - before the action, I am on the shelf (the box for adding a book is
 *     there) and the book is not on it;
 *   - right after, the shelf shows that book's title, its author, and its
 *     cover picture (loaded);
 *   - the other match, "Wandering Moon Lullabies", is nowhere on the page;
 *   - the box for adding a book is empty again and ready for the next one;
 *   - the new book carries a quiet "Just added" (not a "Saved" beside an empty
 *     form);
 *   - after a fresh reload the book, its author and its cover are still on the
 *     shelf, so it was really saved, and the other match is still absent;
 *   - REVIEW (a person decides, not this code): the page reads as a bookshelf
 *     and not a table of records;
 *   - REVIEW: typing and choosing feels quick. The test prints the page's text
 *     and the questions; whoever is reviewing looks at the page and says
 *     whether it does. These don't count toward pass/fail.
 *
 * Deliberately not covered here: what your sister sees and the notice that
 * more books are still being added, whether a book is available or would be
 * wanted back, wishlists, ratings and age ranges, a search with no matches,
 * Open Library being unreachable, and adding the same book twice.
 *
 * The test only looks at what a person can see and do: it finds the box by its
 * visible label and the match by its words, and never looks at how anything is
 * stored (other than seeding the empty shelf into the file the page reads).
 *
 * Usage: node things/test/add-a-book-by-title.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const SHELF_PAGE_PATH = `/`;

const BOOK = 'The Wandering Moon';
const AUTHOR = 'Ilsa Brightwater';
const OTHER_BOOK = 'Wandering Moon Lullabies';

// Fictional books, in the shape Open Library uses. The ISBNs are made up (their
// check digits are valid, so nothing rejects them for being malformed).
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000001W', title: BOOK, author_name: [AUTHOR], cover_i: 9100001,
    isbn: ['9781234567897'], first_publish_year: 2001 },
  { key: '/works/OL9000002W', title: OTHER_BOOK, author_name: ['Tobias Quill'], cover_i: 9100002,
    isbn: ['9780987654328'], first_publish_year: 1998 }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library that knows two books.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'add-a-book-by-title',
    seed: (write) => { write('books.json', []); },
    appDir: THINGS_FOLDER,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close]
  });
  const { page } = t;
  const SHELF = t.url(SHELF_PAGE_PATH);

  const addBox = () => page.getByLabel('Add a book');
  const bookText = () => page.locator('body').innerText();
  const coverLoaded = async () => {
    const cover = page.getByRole('img', { name: new RegExp(BOOK) });
    return (await cover.count()) > 0 &&
      (await cover.first().evaluate(img => img.complete && img.naturalWidth > 0));
  };

  await page.goto(SHELF, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const onShelf = (await addBox().count()) > 0;
  t.expect('before the action, I am on the shelf, with a box for adding a book', onShelf, page.url());
  t.expect('before the action, the book is not on the shelf',
    onShelf && !(await bookText()).includes(BOOK));

  // Act: one action — type part of the title, and choose the first match.
  try {
    await addBox().fill('wandering moon');
    await page.getByText(BOOK, { exact: false }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  } catch (e) {
    t.fail('no way to add a book by typing its title — ' + e.message);
  }

  // Assert, right after the action.
  const text = await bookText();
  console.log('\nREVIEW  Does this read as a bookshelf and not a table of records?');
  console.log('        The page as it appears:\n' + text.split('\n').map(l => '          | ' + l).join('\n') + '\n');
  console.log('REVIEW  Does typing and choosing feel quick?\n');

  const shown = text.includes(BOOK);
  t.expect('right after, the shelf shows the book\'s title', shown, text);
  t.expect('right after, the shelf shows its author', shown && text.includes(AUTHOR), text);
  t.expect('right after, the shelf shows its cover', shown && await coverLoaded());
  t.expect('the other match is nowhere on the page', shown && !text.includes(OTHER_BOOK), text);
  t.expect('the box for adding a book is empty and ready for the next one',
    shown && (await addBox().count()) > 0 && (await addBox().inputValue()) === '');
  t.expect('the new book carries a quiet "Just added"', shown && text.includes('Just added'), text);

  // Assert, after a fresh reload: it was really saved.
  await page.goto(SHELF, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const after = await bookText();
  const stillThere = after.includes(BOOK);
  t.expect('after a reload, the book and its author are still on the shelf',
    stillThere && after.includes(AUTHOR), after);
  t.expect('after a reload, its cover is still there', stillThere && await coverLoaded());
  t.expect('after a reload, the other match is still absent', stillThere && !after.includes(OTHER_BOOK), after);

  // 2 before + 6 right after + 3 after a reload. If an earlier step threw,
  // report against 11 rather than however many ran.
  await t.finish(11, ' (REVIEW items are for a person to decide.)');
}

main();
