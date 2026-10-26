#!/usr/bin/env node
/**
 * User story: as someone cataloguing a book I'm holding, if I type its title and
 * digits that no edition ends in, I want to be told there is no match, so that
 * I don't add a different edition by mistake.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library, the open book database, knows one fictional book
 * with editions whose ISBNs end in 0013 and 3335. I am signed in with a token.
 * The page is open.
 *
 * Act: one action — type the title followed by digits no edition ends in:
 * "amber compass atlas 9999".
 *
 * Assert:
 *   - before the action, no matches are shown;
 *   - after, no matches are listed (the book is not offered with some other
 *     edition's ISBN);
 *   - the page says there is no match.
 *
 * Deliberately not covered here: digits that do match (the-edition-ending-in-
 * these-digits.mjs), the wording (say-when-nothing-matches.mjs), and adding a
 * book by hand.
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node test/digits-that-match-nothing.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

const TITLE = 'Amber Compass Atlas';

// A fictional book in the shape Open Library uses. The ISBNs are made up.
const OPEN_LIBRARY_BOOKS = [
  { key: '/works/OL9000041W', title: TITLE, author_name: ['Pavel Lindqvist'], cover_i: 9100041,
    isbn: ['9780000000013', '9780000003335'],
    editions: { numFound: 1, start: 0, docs: [{ isbn: ['9780000000013'] }] } }
];

async function main() {
  // Arrange: an empty shelf, and an Open Library with one book of two editions.
  const library = await startOpenLibraryStub({ books: OPEN_LIBRARY_BOOKS });
  const t = await startTest({
    name: 'digits-that-match-nothing',
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

  // Act: one action — the title, then digits no edition ends in.
  try {
    await addBox.fill(TITLE.toLowerCase() + ' 9999');
    await page.waitForTimeout(1200);
  } catch (e) {
    t.fail('could not type into the box — ' + e.message);
  }

  // Assert.
  const text = await page.locator('body').innerText();
  t.expect('no matches are listed', (await matches().count()) === 0, text);
  t.expect('the page says there is no match', /no match/i.test(text), text);

  // 1 before + 2 after. If an earlier step threw, report against 3.
  await t.finish(3);
}

main();
