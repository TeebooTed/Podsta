# Podsta improvement plan

Audit date: 9 October 2026. Status updated 10 October 2026 against `main`.

Phase 1 and Phase 2 shipped. Discoverability, sign-up and invites, notifications, multi-photo posting, and likes shipped after that. The installable PWA did not. Inrupt access policies did not. A handle registry was declined.

## Done

| Work | What landed |
| --- | --- |
| Boot | `src/main.jsx` parses, StrictMode is on, Vite config loads. |
| Phase 1 | CI (lint, unit tests, production build). WAC share fails closed. Comments are owner-only. New posts are private. Public and contacts indexes stay in step with edits. Own photos are not downloaded in full just to list them. Discover is an empty directory plus copy-my-WebID, with timeouts. Login recommends Solid Community, not an ACP host. |
| Phase 2 | Home is the following feed. Profile is the post grid and the editor. Phone bottom nav, header on desktop, routes, a Podsta permalink, a public person page, a skippable tour, and the contrast and focus fixes from the audit. |
| Discoverability | Hidden (default), Contacts, or Public. Per-post audience cannot exceed that ceiling. Raising the level does not publish Only-me posts. |
| Sign-up and invites | `/start` sends new people to Solid Community. `/invite?webid=` and a QR code. `@ada` is derived from the WebID. No registry. |
| Notifications | Header badge and `/notifications`. Polling with backoff. Seen state in this browser. A partial check baselines what it could see. A total failure does not wipe the list. |
| Posting | Albums of up to ten photos, carousel, crop and rotate, desktop drop, real upload progress, retry. |
| Likes | Private file in the liker's Pod. Author-published counts. Inbox notices the author merges. |

The original must-fix and should-fix items, by number:

| Item | Status |
| --- | --- |
| 1 App does not parse | Done |
| 2 Recommended login host does not match WAC | Done for the beta. ACP itself is still open. |
| 3 Public comments hole | Done. Strangers still cannot write the author's Pod. Comments now live in the commenter's Pod. |
| 4 Public index drifts from the post | Done |
| 5 Home downloads every photo | Done. Listing reads captions and ACLs. The image loads when a card is on screen. |
| 6 Discover is a dead end | Done |
| 7 No tests or CI | Done |
| 8 Tokens, frames, ACL injection | Done for CSP, `frame-ancestors`, IRI escaping, and https Pod URLs. EXIF stripping is still open. The session still lives in `localStorage`. |
| 9 WCAG AA on the path people use | Done in Phase 2 for contrast, labels, focus, target size, and reduced motion on the screens that shipped. |
| 10 Information architecture | Done |
| 11 Nothing has a URL | Done |
| 12 First run teaches nothing | Done. The tour is skippable. |
| 13 Phone layout | Done |
| 14 Feed bugs with two friends | Done for the retry loop, avatar fallback, and unreachable Pods. A feed cache is still open. |
| 15 PWA claim | The README no longer says the app is installable. Shipping a PWA is still open. |
| 16 Dependency health | Unused-router problem is gone because routes exist. The Inrupt 2.x line is still the one we ship. A major upgrade is open. |
| 17 Notifications | Done as in-app polling. A live Solid channel is only a wake hint, and solidcommunity.net rejected the subscription. |
| 18 Comments other people can leave | Done. Commenter-owned file, inbox notice, author-published list, hide, edit, delete, and block. |
| 19 Image derivatives and EXIF | Open |
| 20 Feed cache | Open |
| 21 Reactions | Done. Likes shipped. |
| 22 Light theme | Open |
| 23 Upload tools | Done for crop, rotate, and progress. Distinct alt text is still the caption. |
| 24 Shortcut help | Shortcuts work and are documented. There is no in-app cheat sheet. |
| 25 TypeScript | Open |
| 26 Unused names | `podsta/inbox/` and `podsta/favorites.ttl` are still unused names in `vocab.js`. The server inbox is `{pod}inbox/`. |

## Remaining

- **Installable PWA.** `public/manifest.json` points at one SVG. There is no service worker and no 192 or 512 PNG. Do not call the app installable until those exist.
- **Inrupt PodSpaces / ACP.** Sharing is WAC `.acl` Turtle. An ACP writer is a separate project.
- **Social comments.** Done. The commenter writes their own Pod. The author publishes, hides, and can block. There is still no public Append on `podsta/comments/`.
- **Image derivatives and EXIF stripping.** Public photos are the uploaded file.
- **Conditional feed fetch.** Indexes are refetched. They are not cached in the browser (`cache: 'no-store'`), and there is no per-friend ETag cursor.
- **Light theme.** `darkMode: 'class'` is unused.
- **TypeScript** at the Pod boundary, when the shapes stop moving.
- **Inrupt client major upgrade**, with a WAC smoke test. Not a drive-by `npm update`.
- **In-app shortcut help.** `h`, `d`, `p`, and `n` are real. `f` still goes Home.

A central handle registry stays out. Matthew skipped it.

## Decisions

These were the open questions on 9 October. The answers that shipped:

1. **Pod servers.** WAC for the beta. Solid Community is the recommended host. solidweb.org is offered. Inrupt PodSpaces is shown as unsupported. ACP is not in scope until someone writes it.
2. **Stay on React.** Yes.
3. **Design.** Keep Fraunces, ink, and the coral accent. Home is the following feed. Profile is the grid. Phone has a bottom bar.
4. **Finding people.** Copy a WebID, follow a WebID, invite links. No registry. The follow list is public only when the profile is Public.
5. **Comments.** The commenter writes their own Pod and notifies the author. The old `podsta/comments/` container stays owner-only. No public Append.
6. **Default visibility.** Private posts, Hidden profile.
7. **Home.** The following feed. Your posts are on Profile.

The license is MIT. See `LICENSE` and the README.
