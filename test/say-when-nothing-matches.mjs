#!/usr/bin/env node
/**
 * User story: as someone adding a book, when I type something and the list stays
 * empty, I want to know whether the page is still looking or has found nothing,
 * so that I don't wait for a result that isn't coming, and don't give up on one
 * that is.
 *
 * Arrange: the shelf is empty (a fictional test copy of the community's data).
 * A stand-in for Open Library, the open book database, knows nothing that
 * matches what I'll type, and is slow to answer (about a second), as the real
 * one sometimes is. I am signed in with a token. The page is open.
 *
 * Act: one action — type "a book nobody has written" into the box for adding a
 * book. Then look twice: while the answer is still on its way, and after it
 * has come back.
 *
 * Assert:
 *   - before the action, the page says nothing about searching;
 *   - while the answer is on its way, the page says it is looking, and does not
 *     say there is no match;
 *   - after the answer, the page says there is no match, and no longer says it
 *     is looking;
 *   - no matches are listed.
 *
 * Deliberately not covered here: the exact wording (REVIEW below), Open Library
 * being unreachable (the page already says so), and adding a book by hand.
 *
 * The test only looks at what a person can see and do.
 *
 * Usage: node test/say-when-nothing-matches.mjs
 */
import { startTest } from './support/harness.mjs';
import { startOpenLibraryStub } from './support/open-library-stub-server.mjs';
import { THINGS_FOLDER } from './support/where.mjs';

async function main() {
  // Arrange: an empty shelf, and a slow Open Library that knows nothing that matches.
  const library = await startOpenLibraryStub({ books: [], delayMs: 1200 });
  const t = await startTest({
    name: 'say-when-nothing-matches',
    seed: (write) => { write('books.json', []); },
    appDir: THINGS_FOLDER,
    pageGlobals: { OPEN_LIBRARY_BASE: library.url, OPEN_LIBRARY_COVERS_BASE: library.url },
    cleanup: [library.close],
    timeout: 5000
  });
  const { page } = t;
  const addBox = page.getByLabel('Add a book');
  const body = () => page.locator('body').innerText();

  await page.goto(t.url('/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const before = await body();
  t.expect('before the action, the page says nothing about searching', !/looking|no match/i.test(before), before);

  // Act: one action — type; then look while waiting, and after.
  let waiting = '';
  let after = '';
  try {
    await addBox.fill('a book nobody has written');
    await page.waitForTimeout(600);          // the debounce is over and the answer is still on its way
    waiting = await body();
    await page.waitForTimeout(3200);         // the answer has come back (the page may ask more than once)
    after = await body();
  } catch (e) {
    t.fail('could not type into the box — ' + e.message);
  }

  // Assert.
  console.log('\nWhile waiting:\n  ' + waiting.split('\n').slice(-3).join('\n  '));
  console.log('After the answer:\n  ' + after.split('\n').slice(-3).join('\n  '));
  console.log('\nREVIEW  Do the two messages read kindly, and say what to try next?');
  t.expect('while waiting, the page says it is looking', /looking/i.test(waiting), waiting);
  t.expect('while waiting, the page does not yet say there is no match', !/no match/i.test(waiting), waiting);
  t.expect('after the answer, the page says there is no match', /no match/i.test(after), after);
  t.expect('after the answer, the page no longer says it is looking', !/looking/i.test(after), after);
  t.expect('no matches are listed', (await page.getByRole('listitem').count()) === 0);

  // 1 before + 5 after. If an earlier step threw, report against 6.
  await t.finish(6, ' (REVIEW items are for a person to decide.)');
}

main();
