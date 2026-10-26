# Backlog: Particular Things

Planned work, parked here so it isn't lost between sessions. Ideas about the software and the community
go here; work on the data itself (renaming, cleaning, changing its shape) goes in the data
repositories' own backlogs. Nothing here is a commitment.

- **Where things stand (22 October 2026; updated below):** Adding a
  book by typing part of its title and choosing a match passes its test against stand-ins
  (`index.html`, `shelf.js`, `shelf.css`;
  story and prose in `test/add-a-book-by-title.mjs`; the stand-in for Open Library is
  `test/support/open-library-stub-server.mjs`). The shelf is the community repository
  `Worthy-Company/Particular-Things`, `main`, built into `shelf.js`; a person only needs a GitHub token
  that can reach it. Not built, each needing its own test first: the gallery that
  pulls a book out, the wishlist, the "only available" filter, what a person without a token sees, the
  notice that more books are coming, and entering by ISBN. The look was sketched in `shelf-sketch.html`
  (throwaway; delete once those are built). Open, on purpose: whether the shelf shows everything or only
  available books by default (it shows everything now; Nate: "it's really others that will live with it," so decide
  the behavior from how they use it); JSON or YAML for the shelf file (JSON so far). `status` carries "available" or
  "would-want-back" in `books.json`. Wanted soon: catalog the remaining books at home before they are given away. Update (23 October 2026): the page no longer
  needs `root`. It loads its shared code from the hosted `platform` (`platform.worthycompany.org`), is
  meant to be served by itself at `things.worthycompany.org` (GitHub Pages on this repository, `main`;
  DNS record `things` pointing to `worthy-company.github.io`), and a search by title now comes first.
  Nate has seen the page work in his browser. What is left before his sister can open it: merge
  `development` into `main` so the live site is the new page, then try a link with her key in a private
  window. `root` is not being published. The community repository stays private. Handoff for a fresh agent (22 October 2026): Nate asked for one. The link
  test and the add-a-book test pass (`node test/background.mjs things`, started with the tool's
  background option). Nate wants to try GitHub Issues for this backlog, but the `gh` token cannot yet
  create issues here (it needs Issues read and write on `things-code`); six items were ready to file:
  Pages, typing a key into the page, choosing the right edition, the gallery, the wishlist, and the
  available filter. He likes numbered messages (`preferences.md`). The shelf page has never been seen
  working in his own browser.

- **Keys from links (built 22 October 2026; one piece left).** A key arriving in a link
  (`/things/#key=...`) is kept in its own slot, taken out of the address, and never overwrites a key a
  person entered (Nate: "why overwrite to begin with?"); the page uses the entered key (`github_token`)
  if there is one, otherwise the link's. Tested: a fresh browser opens a link and sees the shelf
  (`test/open-a-link-with-a-key.mjs`). Not tested, by choice (the stakes are low, and Nate asked whether
  it is needed): a browser holding an entered key opens a link with a different key, and the page still
  uses the entered one. The code does this in one line.
  Left: a place on the page to type or paste a key (its own slice), which helps when a link is lost or a
  key expires and keeps keys out of browser history. Open: if the entered key is refused (it cannot
  reach the shelf), whether to try the link's. Seeing the page as his sister does still needs a private
  window.

- **A search by title finds a book, not the edition on the shelf.** Open Library's title search returns
  one result per work, and its ISBN list mixes the ISBNs of many editions (for *The Polar Express* the
  first is not the 1985 hardcover). The page records the first 13-digit one, so a book added by title can
  show a different cover from the copy in hand. Possible: when the ISBN was typed, record exactly that;
  list editions with their covers to choose from; or let Nate swap the cover. Not designed; needs a test.

- **How does this relate to the house-decluttering thread?** Carried over from the first idea note for
  Particular Things. Books are the first case, but the same instinct covers whatever is leaving the
  house (a spare printer, an outgrown bike). The decluttering itself is thread 2 in
  `life-management-data/CONTEXT.md` (not yet a system); `home/house-organization.txt` there holds only two
  small notes. Things that are not books have no open database to look up, so they would start as a name
  and a note.

- **How the sister gets to the page (thinking, 22 October 2026).** Things this raises, none decided:
  (1) *Where the page is served from.* It loads `../js` and `../css` from `root`, so it has to be served
  with `root`, not from `things-code` alone; GitHub Pages on `root` is the likely way, which needs `root`
  readable by her and Pages to include the `things` submodule (unchecked). `public` already serves
  worthycompany.org. (2) *Who owns the data.* The community repository and the code are under
  `Worthy-Company`; Nate's private data repositories are under his own account. A
  fine-grained token covers one owner, so Nate's one `github_token` cannot cover both his private data
  and the shelf; the shelf may want its own token (a key of its own in `localStorage`), limited to that
  one repository, which is also what his sister should hold. (3) *Setting up.* She should not need
  Settings or a console: a page with no token asks her to paste the one Nate sent, and the shelf's
  repository is built in. (4) *What she can do.* A read-only token must not offer the add box (the page
  can ask GitHub whether the token can write). Then the gallery, wishlist and Send. A change from `life/`
  and `finance/`, which read one person's own private repository: here everyone reads one shared one.
  Nate's further thoughts (same day): members will report availability themselves, so members need to be
  able to write, not only read; a link with the token in it (after the `#`, which a browser never sends
  to a server; the page would store it and clear the address) would spare her any setup; the repository
  could be public, so that reading needs no token at all and only writing does; and his sister could add
  her own books. That last one needs a copy to say whose it is, which the "books stay in the community"
  item above had deferred.

- **A wish is for a book, not for one person's copy.** Nate (October 2026): people could make wishlists
  even for books that nobody has marked available, and someone else might own a copy. So a wish is keyed
  by the book (its ISBN), and any copy in the community can answer it.
  How a member saves wishes (22 October 2026, Nate liked it): with the same write token used to add
  books, the page saves them to the community repository, one file per member (two people saving to one
  shared file can collide), under a members area there. Without a write token a person can look but not
  wish. Settled that day: the community repository stays private for now (a token is needed either way,
  so public gains little), Worthy Company gives members their tokens (no GitHub account required), and
  an unwanted change can be taken back out of the history (Nate: "it's git"). Nate may want members to
  see wishes, particularly unfulfilled ones (and no divorce books or pornography on the list). Changes
  made with a token can be tied to the person it was made for (his sister first); per-member tokens come later. The earlier agent considered GitHub
  Issues as the mechanism for book wishes; files keep the data in plain text anyone can read, which Issues do not.
  Not decided between the two. A wider idea about wishes is in `life-management-data/daybook.md`.

- **Books stay in the community after they move on.** Nate (October 2026): a book stays on the shelf
  after it goes to his sister, so others can see it and wish for it in the future. Then a book on the
  shelf is a particular copy with a place in the world, not only an item someone is offering. Things
  this brings up, none decided: a copy has an owner and a current holder, which differ while it is lent
  ("would want back") and are the same once it is given; the holder is the one who says whether it is
  available now; and who holds what is a fact about people (a child's name, say), so the shelf shows only whether a
  copy is available, never who has it: an "available" filter, not "in use by Anna" (Nate's idea).
  Ties together a wish being for a book (above), a Little Free Library as the handover (below), and the
  history of passing things on that karma would draw on. Nothing in the first slice depends on it: until
  this is designed, a copy is simply on the shelf of whoever added it.

- **Copies that move locally.** Nate's fantasy: someone near his sister drops off a copy for her, and his
  copy goes to someone near him. Fewer miles travelled, and the community can celebrate efficient use of
  natural resources. Needs some idea of where members are, which is personal data: if it is ever used,
  something as coarse as a town, chosen by the member. Not designed.

- **Karma.** Members of a community could see one another's history of passing things on. Nate is
  unsure; the suite's notes (`how-we-work/ABOUT.md`) record that points and badges might feel like
  pressure. Try a plain tally of things kept in use before anything like points.

- **Saying a book is probably not worth passing on, and letting the community weigh in.** Nate may want
  to say in public that a book is poorly written and worth recycling, and others could add their view.
  Recycling is then a good outcome in its own right, not a failure to find a home. Nate sees no need for
  a private opinion kept apart from this, so a remark is simply published with the book. How others add
  theirs is not decided (comments on an issue per book is one way).

- **Little Free Libraries as the way books are handed over.** Nate: a Little Free Library could be the
  transfer mechanism, and maybe every member has one. A book's whereabouts would then sometimes be a
  place, not a person. Not looked into: whether Little Free Library publishes its map as open data.

- **Hand-editable files.** Nate likes files a person can edit, and may prefer YAML or JSON5 to strict
  JSON, whose trailing comma is an error. `life-management-data/AGENTS.md` already says YAML for
  human-edited content; `Company Pages` loads YAML in the browser with js-yaml from a CDN. The community
  files (`books`, and wishes) are the first case to decide. Another case is Nate's private
  `life-management-data/home/recipients.json`, which an agent wrote as JSON against that repository's
  own YAML rule; its `order` field and empty `notes` could go when its format is settled.

- **Fresh approach to authentication.** See `root/BACKLOG.md`. Until then a member holds a token that
  the owner makes for them.

- **More than one open source for finding a book, and maybe scanning a barcode.** Nate wants the entry
  page to use at least one open database, ideally several, and is unsure that typing an ISBN is flow. He
  dislikes photos as a way to catalog (too much data). Findings so far (21 October 2026): Open Library
  finds all 15 of the ISBNs in the first list, each with a cover, and works from a browser page. Google
  Books answered "too many requests" to a single keyless request, so it would need a key. The Library of
  Congress and Wikidata are reachable from a browser page, but a search for those ISBNs at the Library of
  Congress found nothing (the query may be wrong; unproven), and Wikidata's book coverage has not been
  looked at. Idea: read a barcode from the live camera, saving no picture, so a book is one beep.
  Not looked into: which browsers can do it. Nate loves the idea, especially a beep, and wants cataloging
  to be more fun: "play librarian". Open: what playing librarian could mean (a library card and a due-date
  stamp when a book is lent, a checkout sound, a shelf that fills as books are scanned).

- **Look up age range and rating from public sources.** Rating: Open Library gives an average and a
  count for many books, not all. Age range: there is no field; its subject tags only hint ("Juvenile
  fiction", "Reading Level-Grade 9"). Offer a guess for the owner to confirm, never settle it silently.
