// The key a person entered deliberately (Settings), which the other pages share.
const GITHUB_TOKEN_KEY = 'github_token';
// A key that arrived in a link is kept apart, so a link never overwrites one a person entered.
const LINK_KEY = 'key_via_link';
// Everyone using this page looks at the one community shelf, so it is built in.
const SHELF_REPO = 'Worthy-Company/Particular-Things';
const SHELF_BRANCH = 'main';
const SHELF_FILE = 'books.json';
const BOOKS_PER_SHELF = 5;

// Open Library answers from the browser directly. A test points these at a stand-in.
const openLibrary = () => window.OPEN_LIBRARY_BASE || 'https://openlibrary.org';
const covers = () => window.OPEN_LIBRARY_COVERS_BASE || 'https://covers.openlibrary.org';

const statusEl = document.getElementById('status');
const addForm = document.getElementById('add');
const addBox = document.getElementById('add-box');
const addMsg = document.getElementById('add-msg');
const matchesEl = document.getElementById('matches');
const shelvesEl = document.getElementById('shelves');

let books = [];
let justAddedId = null;

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
  statusEl.hidden = !msg;
}

// A link such as /things/#key=... carries a key after the #, which a browser never sends to a server.
// Keep it for later, then take it out of the address so it isn't left there to be shared by accident.
function takeKeyFromLink() {
  const key = new URLSearchParams(location.hash.slice(1)).get('key');
  if (!key) return;
  localStorage.setItem(LINK_KEY, key);
  history.replaceState(null, '', location.pathname + location.search);
}

// The key a person entered wins; otherwise the one from a link.
function readSettings() {
  const token = localStorage.getItem(GITHUB_TOKEN_KEY) || localStorage.getItem(LINK_KEY) || '';
  return { token, repo: SHELF_REPO, branch: SHELF_BRANCH };
}

// A cover, from the ISBN so that what is shown is the edition that was saved.
// Open Library answers 404 when it has none (default=false), and the title
// stands in on a plain cover.
function coverUrl(isbn) {
  return `${covers()}/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
}

function renderBook(b) {
  const name = b.name || '(untitled)';
  return `
    <figure class="book" data-title="${escapeHtml(name)}">
      <img class="cover" alt="Cover of ${escapeHtml(name)}" src="${escapeHtml(coverUrl(b.isbn))}">
      <figcaption>
        <span class="title">${escapeHtml(name)}</span>
        ${b.author ? `<span class="author">${escapeHtml(b.author)}</span>` : ''}
        ${b.id === justAddedId ? '<span class="just-added">Just added</span>' : ''}
      </figcaption>
    </figure>`;
}

function renderShelves() {
  if (!books.length) {
    shelvesEl.innerHTML = addForm.hidden ? '' : '<p class="empty">The shelf is empty. Add a book to start.</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    html += `<div class="shelf">${books.slice(i, i + BOOKS_PER_SHELF).map(renderBook).join('')}</div><div class="board"></div>`;
  }
  shelvesEl.innerHTML = html;
  shelvesEl.querySelectorAll('img.cover').forEach(img => {
    img.addEventListener('error', () => {
      const plain = document.createElement('div');
      plain.className = 'plain';
      plain.textContent = img.closest('.book').dataset.title;
      img.replaceWith(plain);
    });
  });
}

async function loadShelf({ token, repo, branch }) {
  const file = await ghReadFile(token, repo, SHELF_FILE, branch);
  books = Array.isArray(file?.content) ? file.content : [];
}

// ----- finding a book to add -----

// The ISBN to record for a search result: a 13-digit one if it has any.
function pickIsbn(doc) {
  const all = Array.isArray(doc.isbn) ? doc.isbn : [];
  return all.find(i => /^97[89]\d{10}$/.test(i)) || all[0] || '';
}

// The ISBN to show and record. A work's own list mixes the ISBNs of many editions (digital ones, gift
// sets), so the edition Open Library ranks first for the search comes first; a work with no edition
// data falls back to its list.
function bestIsbn(doc) {
  if (doc.chosenIsbn) return doc.chosenIsbn; // the person typed the end of it
  const edition = doc.editions && Array.isArray(doc.editions.docs) ? doc.editions.docs[0] : null;
  return (edition && pickIsbn(edition)) || pickIsbn(doc);
}

// The edition whose ISBN ends in the digits the person typed, if the work has one. A 13-digit ISBN is
// preferred over a 10-digit one.
function isbnEndingIn(doc, digits) {
  const fromEditions = ((doc.editions && doc.editions.docs) || []).flatMap(e => e.isbn || []);
  const all = [...(doc.isbn || []), ...fromEditions].filter(i => i.endsWith(digits));
  return all.find(i => /^97[89]\d{10}$/.test(i)) || all[0] || '';
}

// An ISBN as shown: its last four digits in bold, to compare with the book in hand at a glance.
function isbnHtml(isbn) {
  return escapeHtml(isbn.slice(0, -4)) + '<strong>' + escapeHtml(isbn.slice(-4)) + '</strong>';
}

function renderMatches(docs) {
  matchesEl.innerHTML = '';
  docs.forEach(doc => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    const thumb = doc.cover_i
      ? `<img alt="" src="${escapeHtml(`${covers()}/b/id/${encodeURIComponent(doc.cover_i)}-S.jpg`)}">`
      : '<span class="nocover"></span>';
    const by = (doc.author_name || []).join(', ');
    const isbn = bestIsbn(doc); // the one that would be saved, so what is seen is what is kept
    btn.innerHTML = `${thumb}<span><span class="match-title">${escapeHtml(doc.title)}</span>` +
      `${by ? `<br><span class="match-author">${escapeHtml(by)}</span>` : ''}` +
      `${isbn ? `<br><span class="match-isbn">ISBN ${isbnHtml(isbn)}</span>` : ''}</span>`;
    btn.addEventListener('click', () => addBook(doc));
    li.appendChild(btn);
    matchesEl.appendChild(li);
  });
}

let searchTimer = null;
let searchCount = 0;

function scheduleSearch() {
  clearTimeout(searchTimer);
  const text = addBox.value.trim();
  if (text.length < 3) { searchCount++; renderMatches([]); addMsg.textContent = ''; return; }
  searchTimer = setTimeout(() => search(text), 250);
}

// One Open Library search. `field` is "title" (the title alone) or "q" (everything: title, author, ...).
async function findBooks(field, value, limit = 8) {
  const url = `${openLibrary()}/search.json?${field}=${encodeURIComponent(value)}&limit=${limit}&fields=key,title,author_name,isbn,cover_i,editions,editions.isbn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open Library said ' + res.status);
  const data = await res.json();
  // A book with no ISBN can't be recorded.
  return (data.docs || []).filter(d => d.title && bestIsbn(d));
}

async function search(text) {
  const mine = ++searchCount;
  const looksLikeIsbn = /^[\d-]{10,17}$/.test(text);
  addMsg.textContent = 'Looking…';
  addMsg.className = 'save-msg';
  try {
    let docs = [];
    // A title followed by digits: the digits are the end of the ISBN on the book in hand, so look in the
    // title's editions for the one ending in them. Many works share a title, so look further down.
    const withDigits = !looksLikeIsbn && text.match(/^(.*\S)\s+(\d{3,12})$/);
    if (withDigits) {
      const found = await findBooks('title', withDigits[1], 40);
      docs = found.map(d => ({ ...d, chosenIsbn: isbnEndingIn(d, withDigits[2]) })).filter(d => d.chosenIsbn);
    }
    // Otherwise (or if the digits were part of the title, as in "Apollo 13"): a title search puts the
    // book meant first; if it finds nothing (an author, half a title), search everything.
    if (!docs.length) {
      docs = looksLikeIsbn
        ? await findBooks('q', 'isbn:' + text.replace(/-/g, ''))
        : await findBooks('title', text);
      if (!looksLikeIsbn && !docs.length) docs = await findBooks('q', text);
    }
    if (mine !== searchCount) return; // a newer search has taken over
    renderMatches(docs);
    addMsg.textContent = docs.length ? '' : `No match for “${text}”. Try part of the title, or the ISBN.`;
  } catch (err) {
    if (mine !== searchCount) return;
    renderMatches([]);
    addMsg.textContent = 'Could not reach Open Library.';
    addMsg.className = 'save-msg error';
  }
}

// ----- adding it to the shelf -----

async function addBook(doc) {
  const settings = readSettings();
  const isbn = bestIsbn(doc);
  searchCount++; // any search still on its way is no longer wanted
  clearTimeout(searchTimer);
  renderMatches([]);
  await withSaveFeedback({ disable: addBox, msgEl: addMsg, successText: '' }, async () => {
    let newId = null;
    const saved = await ghUpdateList(settings.token, settings.repo, SHELF_FILE, settings.branch, list => {
      newId = shortId(list.map(b => b.id));
      return [...list, {
        id: newId,
        type: 'book',
        name: doc.title,
        ...((doc.author_name || []).length ? { author: doc.author_name.join(', ') } : {}),
        isbn,
        status: 'available'
      }];
    }, 'Add ' + doc.title);
    books = saved;
    justAddedId = newId;
    addBox.value = '';
    renderShelves();
  });
  addBox.focus();
}

// ----- starting up -----

async function init() {
  if (location.protocol === 'file:') {
    setStatus('Open this page through a local server, not from a file (see docs/serve-locally.md).', true);
    return;
  }
  takeKeyFromLink();
  const settings = readSettings();
  if (!settings.token) {
    setStatus('To see the shelf, open the link you were sent, or add a GitHub token in Settings.', true);
    return;
  }
  try {
    await loadShelf(settings);
  } catch (err) {
    setStatus('Could not read the shelf: ' + err.message, true);
    return;
  }
  setStatus('');
  addForm.hidden = false;
  renderShelves();
}

addForm.addEventListener('submit', e => e.preventDefault());
addBox.addEventListener('input', scheduleSearch);
// The arrow keys move through the matches and Enter picks one (the platform's picker; a click works as it did).
wirePicker({
  inputEl: addBox,
  listEl: matchesEl,
  onClose: () => { searchCount++; clearTimeout(searchTimer); renderMatches([]); addMsg.textContent = ''; }
});
init();
