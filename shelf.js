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
    btn.innerHTML = `${thumb}<span><span class="match-title">${escapeHtml(doc.title)}</span>` +
      `${by ? `<br><span class="match-author">${escapeHtml(by)}</span>` : ''}</span>`;
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
  if (text.length < 3) { renderMatches([]); return; }
  searchTimer = setTimeout(() => search(text), 250);
}

async function search(text) {
  const mine = ++searchCount;
  const looksLikeIsbn = /^[\d-]{10,17}$/.test(text);
  const q = looksLikeIsbn ? 'isbn:' + text.replace(/-/g, '') : text;
  const url = `${openLibrary()}/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,isbn,cover_i`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open Library said ' + res.status);
    const data = await res.json();
    if (mine !== searchCount) return; // a newer search has taken over
    // A book with no ISBN can't be recorded.
    renderMatches((data.docs || []).filter(d => d.title && pickIsbn(d)));
    addMsg.textContent = '';
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
  const isbn = pickIsbn(doc);
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
init();
