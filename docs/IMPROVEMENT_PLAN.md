# Podsta improvement plan

Audit date: 9 October 2026. This is a plan only. The only code changes in this pull request are the three trivial fixes listed at the end. Matthew should review this before implementation starts.

## How this was reviewed

Podsta is a static React app. There is no backend. After sign-in, the browser talks to the user's Solid Pod with `@inrupt/solid-client` and `@inrupt/solid-client-authn-browser`.

What ran here:

- `npm install`, `npm audit` (including `--omit=dev`), `npm outdated`
- `npx eslint src --ext .js,.jsx`
- `npx vite build` (fails on current `main` until the config fix below)
- Dev server on `http://127.0.0.1:5173` after the boot fixes
- Live checks of the login and directory URLs the app ships with

What did not run: a completed Solid login. Creating a Pod needs an interactive identity-provider signup, and the app cannot load Home, Friends, Discover, or Profile until that session exists. Those screens were rendered from the real page components with local fixture posts, at 1440×900 and 390×844, so the layout review is of the real UI. Pod round-trips (upload, ACL, cross-pod feed, comments from a second person) were read from the code and not executed against a Pod.

Screenshots from that pass are attached to the audit notes. Login is the real signed-out app. Every other screen is the real component tree with fixture data.

## What the app is today

Podsta is a personal photo-and-text journal stored in the signed-in user's Pod, plus a following feed built from each friend's `public-index.ttl`.

Signed-out, there is one screen: pick an identity provider (Inrupt, solidcommunity.net, solidweb.org, or a custom issuer URL) and leave the site for OIDC. Signed-in, four tabs live in React state, not in the URL:

| Tab | What it actually is |
| --- | --- |
| Home | The user's own posts, newest first, as a 1/2/3-column card grid. Filter, search, share, edit, delete, comments, lightbox. |
| Friends | A horizontal row of people you follow, then the same card grid of their public posts. |
| Discover | Paste a WebID, a friends-of-friends list, and a community directory. |
| Profile | An editor for display name, bio, and avatar, plus WebID, Pod URL, and counts. |

Posts are either a binary under `podsta/photos/` with an optional `.meta` caption, or a Turtle file under `podsta/posts/`. Public posts are also listed in `podsta/public-index.ttl`, which is the right way to build a feed: most Pod servers will not list a container to the public. Friends, the Podsta profile, and comments have their own files under `podsta/`. Details match the README's data-model section.

The stack is React 18, React Router 6 (installed, never imported), Vite 5, Tailwind 3, and the Inrupt Solid libraries on the 2.x line. About 4,200 lines under `src/`. No tests, no CI, no TypeScript (the `@types/*` packages are unused).

The visual system is already a point of view: Fraunces plus Manrope, a warm near-black (`ink`), one coral accent (`#e85d3c`), and a green "public" signal. That is worth keeping. The structure around it is closer to an admin grid than to a photo app, and several of the decentralized flows are wired in a way that will fail or mislead on first use.

## Keep

- The public-index pattern (`src/lib/publicIndex.js`). Do not go back to "list the photos container."
- Private-by-default on new posts.
- React text rendering. There is no `dangerouslySetInnerHTML`. Captions, bios, and comments are text nodes.
- Client-side checks on image type and the 10 MB cap (`src/lib/vocab.js`, `validatePhotoFile`).
- Optimistic share/delete with a revert path in `src/App.jsx`.
- The editorial palette and type. Phase 2 should change layout and flows, not throw out the identity.
- Global `:focus-visible` outlines, a viewport that still allows pinch-zoom, and `lang="en"`.

## Priority

Effort is scope, not a calendar estimate.

- **S** — one module, or a few localized edits, low behavioral risk.
- **M** — a flow that crosses UI and Pod code, or needs a test harness.
- **L** — crosses providers or security model, and should not start until the decision in the last section is made.

### Must-fix

These are broken boots, data-loss or privacy bugs, or barriers that stop a new person from using the app safely.

1. **The app does not parse on `main`.** Effort: S. Done in this PR.
   - `src/main.jsx` calls `document.get ElementById` (the space makes it a syntax error) and drops `StrictMode`. Introduced in `aeea31a`.
   - `vite.config.js` has a stray `build: { ... }` block before `export default`, so Vite cannot load the config. Introduced in `ddf895f`.
   - `npx vite build` and ESLint both fail closed on those two files. ESLint reports nothing else.

2. **The recommended login provider does not use the access-control model this app writes.** Effort: L. Decision 1 below.
   - Sharing is hand-written Web Access Control: a Turtle file at `<resource>.acl` (`src/lib/acl.js`).
   - The first button on the login screen is Inrupt, labeled "recommended" (`src/pages/LoginPage.jsx`). Inrupt PodSpaces documents Access Control Policies (ACP), not WAC. A `.acl` file stored there does not grant public read. Share will look successful or will fail opaquely, and friends will see nothing.
   - `https://solidcommunity.net/` responded here as Community Solid Server and advertised `WAC-Allow` and a `rel="acl"` link, so the WAC code has a plausible host. `https://login.inrupt.com/` responds, but that only means the OIDC page is up.
   - The README says the Turtle ACLs were tested on NSS, ESS, and CSS. ESS PodSpaces is ACP. That claim should be re-tested and rewritten per provider before it stays in the docs.

3. **Public comments both fail for other people and invite writes into the owner's Pod.** Effort: M.
   - `makeCommentable` (`src/lib/acl.js`) grants `foaf:Agent` Read and Append on the comments container, with `acl:default`, the first time any post is shared (`sharePost` in `src/lib/posts.js`).
   - On a WAC server, Append plus `default` lets any client create resources in `podsta/comments/`. That is a storage-fill and spam hole in the owner's Pod. There is no quota, no size check on the way in, and no UI to see unexpected files.
   - `postComment` (`src/lib/comments.js`) does not use Append. It read-modify-writes one Turtle file with `saveSolidDatasetAt` (HTTP PUT), which needs Write. A visitor with only Append cannot update that file, so comments from anyone but the owner are likely to fail. Two owners commenting at once also last-write-wins, because the whole file is replaced.
   - `loadComments` turns every error, including 403 and 500, into `[]`. The drawer then says "No comments yet."
   - There is no delete, despite the README saying the owner can remove comments.

4. **The public index drifts from the post.** Effort: M.
   - Friends' photo cards render the caption stored on the index, not the `.meta` file (`src/lib/feed.js`). `editPhotoCaption` and `editTextPost` never call `addToPublicIndex`.
   - A photo shared with an empty caption does not get a public ACL on `.meta` (`sharePost` only appends `.meta` when `post.caption` is set). A caption added later stays private, and the index still has the old text.
   - `shareResources` / `unshareResources` throw only when every URL fails. One sibling can stay private while the UI says the post is public.
   - `handleCompose` in `src/App.jsx` shows "Posted, but sharing failed" and then always shows "Posted publicly" when the checkbox was on. One toast slot means the user only sees the success.

5. **Opening Home downloads every photo into memory.** Effort: M.
   - `loadOwnPhotos` calls `getFile` on every image and `isPublic` (an anonymous `HEAD`) on every post (`src/lib/posts.js`). A few dozen multi-megabyte originals will stall the tab and can trip Pod rate limits. The feed path already uses the image URL directly. Own posts should too, with the session's authenticated `fetch` if the file is private.
   - `isPublic` treats any thrown `HEAD` as private. A CORS failure or a server that does not allow `HEAD` marks a public post private, and the next toggle will try to "share" it again.

6. **Discover is a dead end, and one path can hang.** Effort: M.
   - `REGISTRY_URL` (`src/lib/discover.js`) returned HTTP 404 from jsDelivr. The fallback list is a single profile, `https://demo.inrupt.net/profile/card#me`. That host does not resolve anymore (`inrupt.net` was shut down in 2025).
   - "List yourself" points at `https://github.com/podsta-app/registry`, which returned 404.
   - Friends-of-friends reads `podsta/contacts/friends.ttl` on each friend's Pod. Nothing in `src/lib/friends.js` ever marks that file public, so the read fails for everyone. The catch is silent, which is fine, but the feature cannot succeed.
   - Those fetches have no timeout. `Promise.allSettled` still waits for a hung connection, so "Searching your friends' networks…" can spin for as long as the browser keeps the socket open.
   - The directory still renders the dead demo as a person you can follow. That is worse than an empty directory.

7. **There is no safety net in the repo.** Effort: M.
   - No `test` script, no `tests/`, no GitHub Actions. The ACL templates, WebID normalizer, and index add/remove are pure enough to unit test without a Pod.
   - ESLint is flat-config and only checks hooks, unused vars, and JSX usage. It does not typecheck. `npm run lint` happens to still accept `--ext` on ESLint 9.39, but that flag is obsolete and should not be the thing CI depends on.
   - Login errors are `console.error` only (`src/pages/LoginPage.jsx`). A rejected issuer returns the button to idle and says nothing.
   - There is no React error boundary. One throw in a card blanks the app.

8. **Tokens, frames, and ACL injection.** Effort: M for headers and escaping; the library upgrade is its own line below.
   - `@inrupt/solid-client-authn-browser` keeps the session in `localStorage`. Any XSS is a Pod takeover. The app currently has no HTML injection sink, which is the main reason this is not an active incident. There is still no Content-Security-Policy.
   - `vercel.json` sets `X-Content-Type-Options` and `Referrer-Policy` only. It does not set `Content-Security-Policy` or `frame-ancestors`. The share control can be clickjacked.
   - ACL Turtle is built by string interpolation (`PUBLIC_TURTLE` and the siblings in `src/lib/acl.js`). A `>` in a resource URL or WebID closes the IRI and can add triples. Photo slugs are sanitized; WebIDs and issuer-supplied Pod URLs are not.
   - Uploads are stored as the original file. Public photos keep EXIF, including GPS, with no strip step.
   - `findPodUrl` uses the first `pim:storage` on the WebID document as a link (`Open my Pod`). A malicious identity provider could put a non-HTTP URL there. Allow only `https:` (and `http:` on localhost).

9. **The UI does not meet WCAG AA on the path a person actually uses.** Effort: M. Measured contrast is the computed ratio for the hex tokens in `tailwind.config.js`.
   - Primary buttons are 14px `ink-50` (`#faf8f5`) on accent (`#e85d3c`): about **3.3:1**. AA for normal text is 4.5:1. Every "Post", "Follow", and "Save" button fails.
   - `ink-400` (`#8a7a5e`) on card `ink-800` (`#1a1610`) is about **4.3:1**. It is used at `text-xs` / `text-sm` for hints, timestamps, and helper copy, so those fail too. The same pair on the page background (`#0e0c08`) just clears 4.5:1. Do not rely on that.
   - The unfollow control on Friends is `w-5 h-5` (20px) and `opacity-0` until hover (`src/pages/FeedPage.jsx`). WCAG 2.2 target-size minimum is 24px, and a hover-only control is not available to touch or keyboard users. On a phone that row cannot be used to unfollow.
   - Several actions are emoji with no accessible name (`💬` on own posts, `🔗`, `⋯` is labeled, `↻ Refresh`).
   - Search boxes and the WebID field are placeholder-only. Visible labels in the composer and profile are not tied to inputs with `htmlFor` / `id`.
   - `Modal`, the comments drawer, and the lightbox set `role="dialog"` / `aria-modal` but do not move focus inside, trap it, or set `aria-labelledby`. Escape works. Background content still tabs.
   - The login mark uses an infinite pulse. Skeleton shimmer is infinite. There is no `prefers-reduced-motion` handling. WCAG 2.2.2 (Level A) covers auto-playing motion that lasts more than five seconds and cannot be paused.
   - Tabs are not a `tablist`. There is no `h1` once you are signed in. The loading spinner is not a live region.
   - The account menu and post menu close on `mousedown` outside, not on Escape, and not when focus leaves.

### Should-fix

These are why it does not yet feel like a photo app, and why the second session will be frustrating.

10. **Information architecture points at the archive, not the people.** Effort: M. Decision 3.
    - Instagram's home is the following feed. Podsta's Home is "my files," and the feed is a tab called Friends. Both are the same three-column card grid, so a portrait and a long note compete as if they were the same kind of object.
    - A single reading column for the feed, and a tight media grid on the person's profile, matches how people already understand this kind of app. The editorial type can live in that structure.
    - Empty Friends explains Discover and then offers no button to go there (`src/pages/FeedPage.jsx`). Empty Home does have a create button. That asymmetry showed up immediately in the empty-state screenshots.
    - There is no way to open another person's profile. Follow never leads to a page, only to a row of initials.

11. **Nothing has a URL.** Effort: M.
    - `react-router-dom` is a dependency and a manual chunk, and it is not imported. Tabs reset on refresh. "Copy link" copies the Pod resource URL, so the recipient gets a Turtle document or a raw image, not Podsta.
    - Phase 2 should add real routes: `/`, `/friends`, `/discover`, `/profile`, `/p/:id` for a post if you decide posts are addressable inside the app. Until then, remove the unused dependency so audit output is about code you ship (Effort: S, can happen in phase 1).

12. **First run teaches nothing.** Effort: M. Decision 4.
    - After OIDC, if the WebID has no `pim:storage`, the user gets one error string and an empty shell. If it does, they land on an empty archive with no prompt to set a name, no explanation that the WebID is how someone follows them, and no walkthrough of private versus public.
    - The words "WebID", "Pod", and "provider" appear on the login card without an example of which URL is which. The custom-issuer field will accept any origin; that is correct for Solid and also a phishing box. Say so next to the field.
    - Profile later shows "Identity provider" as the WebID host (`shortWebId`). For PodSpaces the WebID host and the issuer host differ. Label it "WebID host" or look up the issuer from the session.

13. **Phone layout fights the thumb and the composer.** Effort: M.
    - The README described a bottom tab bar. The tabs are a second row under the header (`src/components/Header.jsx`). This PR corrects that sentence. The FAB sits over the bottom-right of the content, and `main` has no extra bottom padding, so the last card's controls sit under the button. `viewport-fit=cover` is set, and nothing reads `safe-area-inset-*`.
    - The composer footer is a single non-wrapping flex row: a checkbox, "Share publicly", a parenthetical, Cancel, and Post (`src/components/Composer.jsx`). At 390px that row overflows. The same screenshot pass showed the photo preview and caption, with the actions crowded at the bottom edge.
    - Comments become a full-width sheet, which is right, but the thread is easy to miss behind the home grid if the drawer fails to paint as a sheet. Confirm focus and scroll locking together when you build the focus trap.
    - Unfollow, covered above, is the sharpest mobile bug in Friends.

14. **Feed bugs that will show up as soon as two friends exist.** Effort: S for the effect; M if you add caching in the same pass.
    - `FeedPage` hydrates every text post immediately, despite the comment that says it waits for scroll. The effect depends on `hydrated`. A text post that fails to load is retried on every successful sibling update, so one dead URL plus one good URL retries forever.
    - `Avatar` hides a broken image and then tries to show `nextSibling`. The initials fallback is the other branch of the component, not a sibling, so a dead avatar URL becomes a blank circle (`src/components/Avatar.jsx`).
    - Cached friend names are never refreshed. The file comment mentions `refreshFriend()` and that function does not exist.

15. **PWA and performance polish that the README already claims.** Effort: S to stop claiming it; M to do it.
    - `public/manifest.json` points at one SVG icon. There is no service worker. Many browsers will not offer install. Either ship 192 and 512 PNG icons plus a minimal offline shell, or stop saying "PWA-ready" until phase 3.
    - Three Google font families load from `fonts.googleapis.com` on the critical path (`index.html`). Self-host the weights you use. The film-grain `feTurbulence` overlay on `body::before` is a fixed full-viewport filter and is a common source of mobile jank. Make it optional or static.
    - `vite.config.js` emits production source maps. Useful while you are the only deployer; say so, or turn them off for the public host. A production build here produced an Inrupt vendor chunk of about 549 kB minified (155 kB gzip). That is the Solid client, not the UI, and it is the whole first load because auth and posts import it up front.
    - Own-photo lazy object URLs are a good instinct (`PostCard`) and are undermined by `loadOwnPhotos` fetching the bytes first. Fix item 5 and this mostly falls out.

16. **Dependency health, without a blind upgrade.** Effort: S to remove unused packages; M to move Inrupt majors.
    - Production `npm audit`: 4 high, 5 moderate, 0 critical. The highs are `serialize-javascript` through `@inrupt/oidc-client` → `solid-client-authn-browser`, plus the moderate `uuid` bound through `solid-client`, plus React Router advisories on a library the UI does not import.
    - The serialize-javascript advisory is a Node-oriented RCE gadget in a serializer. Confirm it is actually reachable in the browser bundle before describing it as a live exploit. It is still a reason to leave the 2.x Inrupt line: `solid-client` 2.1.2 versus latest 4.0.0, authn-browser 2.5.0 (lockfile) versus latest 5.0.1. Those are breaking upgrades. Do them as a dedicated pass with a WAC (and, if you choose it, ACP) smoke test.
    - Dev audit noise is mostly Vite 5 / esbuild / PostCSS / Tailwind's micromatch and braces chain. The esbuild issue is "a website can talk to your dev server." It matters if `vite` is exposed beyond localhost. Upgrading Vite 5 → 8 and Tailwind 3 → 4 is its own migration, not a `npm update`.
    - `uuid@10` is deprecated in the tree via Inrupt. It goes away with the client upgrade.

### Nice-to-have

17. **Notifications.** Effort: L. `PATHS.inbox` is already reserved. Solid LDN (Linked Data Notifications) fits "someone commented" without a Podsta server. Do this after comments have a safe write model.
18. **One resource per comment, with owner delete.** Effort: M, and only after item 3. Matches Append better than one shared file, and makes moderation possible.
19. **Image derivatives.** Effort: M. Store a display-sized JPEG/WebP next to the original so feeds never ship a 10 MB file. Strip EXIF on the display copy at the same time.
20. **Feed cache.** Effort: M. The README already names it: ETag or `Last-Modified` per friend index, and a "since" cursor. Do not refetch every index on every tab visit.
21. **Reactions.** Effort: M, product call. The README defers likes on purpose. Leave them deferred unless you explicitly want them. A quiet network is a reasonable Podsta trait.
22. **Light theme.** Effort: S once tokens are complete. `darkMode: 'class'` is set and unused. Only add a light theme after the AA contrast pass, or you will certify two failing palettes.
23. **Upload tools.** Effort: M. Crop, focal point, distinct alt text (the caption is doing two jobs), and a progress state. `saveFileInContainer` offers no progress today; large photos look frozen on "Posting…".
24. **Shortcut help and menu keyboard behavior.** Effort: S. `h` `f` `d` `p` `n` are real and undocumented except in `title` attributes. They also fire while a dialog is open if focus is on the drop-zone button. `confirm()` for unfollow should become the same inline confirm posts already use.
25. **TypeScript at the Pod boundary.** Effort: L. Worth it when the data shapes stop moving. Not a prerequisite for phase 1 or 2.
26. **Unused CSS.** Effort: S. `.grid-masonry` and `.tab-active` have no callers. `PATHS.favorites` and `PATHS.inbox` are unused. `checkPublicMany`, `debounce`, and `hashString` are unused. Delete them when you touch those files, not as a drive-by.

## Roadmap

### Phase 1 — Foundation, tooling, security

Goal: a build that stays green, a share button that tells the truth on a provider you actually support, and no stranger-writable folder in the Pod.

- Land the boot fixes (this PR).
- Add CI: lint, unit tests, production build. Start tests with ACL escaping, `normalizeWebId`, public-index add/remove, and the share-toast branch.
- Remove `react-router-dom` until phase 2 routes exist, so the audit is about code that ships. Re-add a current major when you add routes.
- Fix the compose toast, index updates on edit, and partial ACL failure so the UI cannot say "public" when a sibling write failed.
- Stop granting public Append on the comments container. Until the comment model is redesigned, comments are owner-only and the drawer says that. This is a behavior cut. It is safer than shipping the hole.
- Stop calling `getFile` for every own photo. Add timeouts and `AbortSignal` to cross-pod fetches.
- Security headers on `vercel.json`: a strict CSP (Solid fetch and, until you self-host them, the font origin), `frame-ancestors 'none'`, and `https:`-only Pod and avatar URLs.
- Replace the dead registry seed with an empty directory and a straight explanation. Remove the 404 "List yourself" link until a real registry exists.
- Change the login screen so Inrupt is not marked recommended while the app is WAC-only. Copy should name one provider you have tested that week.
- ESLint script without `--ext`. A Prettier check can be CI-only (`prettier --check`), not a rewrite of every file.

Exit criteria: `npm run lint` and `npm run build` pass in CI; a unit test locks the ACL templates; sharing a post on the chosen provider makes `public-index.ttl` and the media anonymously readable; a second WebID cannot PUT or POST into `podsta/comments/`; Home with a few dozen photos does not download every original up front.

### Phase 2 — Core flows

Goal: a new person can sign in, understand where their data is, publish one post, and find one friend, on a phone, at AA.

- Onboarding after the first successful session: what a Pod is, set a display name, show the WebID with copy, explain private versus public, then offer the composer. Keep it skippable.
- Information architecture from decision 3. Recommendation in that section: the following feed is the landing tab, the archive and the media grid live on Profile, Discover stays its own tab.
- Bottom navigation on small screens, header navigation on large screens, FAB clearance, safe areas, composer footer that wraps or stacks.
- Routes and a Podsta permalink for a public post that opens this app, with the raw Pod URL still available as "open original."
- A public profile view for someone you might follow: name, bio, avatar, public grid, Follow. The editor stays on your own profile.
- WCAG AA pass from item 9: button and secondary-text contrast, real labels, accessible names, focus trap, 24px targets, unfollow visible without hover, `prefers-reduced-motion`, tab semantics, spinner and toast announced.
- Empty and error copy that continues the task: empty feed links to Discover; registry failure does not show a fake person; login and comment failures say what failed and what to do; `isPublic` failures are "unknown," not "private."
- Friend management that works on touch, including unfollow.

Exit criteria: keyboard-only and phone-width passes of login → onboard → private post → public post → copy WebID → follow → see the post in the feed; axe or an equivalent check reports no serious contrast, name, or dialog issues on those screens.

### Phase 3 — A network

Goal: features that need the phase 1 security model and the phase 2 skeleton.

- Comments redesigned: one resource per comment, created in a way that matches the ACL you are willing to grant, with owner delete and a visible error when the Pod refuses.
- Display derivatives and EXIF stripping.
- Conditional feed fetch (ETag / since).
- Optional notifications.
- A registry only if you are willing to host and moderate it (decision 4).
- Installable PWA once icons and an offline shell exist.
- Inrupt major upgrade, and ACP if decision 1 says providers that only speak ACP are in scope.

## Decisions needed

These change the shape of phase 1 and 2. Defaults are recommendations so work can start if you agree.

1. **Which Pod servers does Podsta support?**
   - The code speaks WAC only. Inrupt PodSpaces speaks ACP. solidcommunity.net currently looks like CSS with WAC.
   - **Recommendation:** pick WAC-capable servers for the beta (verify solidcommunity.net and solidweb.org with a real share test), and take Inrupt off the "recommended" slot until an ACP writer exists. Supporting both is the long-term answer and it is a separate project (`@inrupt/solid-client` has ACP helpers, and they do not match the Turtle templates). Do not promise ESS in the README until that project exists.

2. **Stay on React?**
   - **Recommendation:** yes. Podsta is a Solid *protocol* app written in React. Rewriting the UI in SolidJS, or in another framework, does not fix ACLs, the index, or onboarding. TypeScript is optional and fits better after the data shapes settle, at the `src/lib` boundary first.

3. **Design direction?**
   - **Recommendation:** keep the warm editorial theme (Fraunces, ink, one accent). Change the structure toward a photo app: one-column following feed, profile media grid, bottom nav on phones, a composer that fits a phone, real routes. Do not reskin it as Instagram. The identity is the part that already feels considered; the grid-of-everything is the part that feels like a dashboard.

4. **How do people find each other?**
   - **Recommendation:** for the beta, manual WebID plus a big "copy my WebID" action, and an honest empty directory. A CDN JSON file you do not control is a central dependency and, today, a 404. Host a registry later only if you want the moderation job. Friends-of-friends can come back when `friends.ttl` is published on purpose, with a timeout, and with a setting. Publishing the follow list should be opt-in; it is a social graph.

5. **Where do comments live?**
   - **Recommendation:** do not grant the public write access to the owner's Pod in phase 1. Owner-only notes are enough until phase 3. If comments must be social, store each comment as its own resource and choose an ACL you can explain in one sentence (for example, "anyone can add a comment file, nobody can edit someone else's, the owner can delete"). The current single-file PUT does not match Append.

6. **Default visibility?**
   - **Recommendation:** keep private-by-default. Say it in the composer in plain language, and make the failure toast the one that sticks.

7. **What is "Home"?**
   - **Recommendation:** Home is the following feed. Your own posts live under Profile, with the same public/private controls. The current names fight the product ("Friends" is the feed, "Home" is the archive).

## Trivial fixes included here

Nothing else in the repo was changed.

| Change | Why it is safe |
| --- | --- |
| `src/main.jsx` parses again, and `React.StrictMode` is restored around `<App />`. | Restores the file from before `aeea31a`. The space in `get ElementById` prevented the module from loading. |
| The stray top-level `build:` block is removed from `vite.config.js`. | It was invalid JavaScript inserted in `ddf895f`. The real `build` options inside `defineConfig` are unchanged. |
| README feature line no longer says the mobile tabs are a bottom bar. | The tabs render under the header in `src/components/Header.jsx`. The floating compose button is unchanged. |

## Suggested first implementation PR after this one

Phase 1, in this order, as its own review: CI and unit tests, the share-toast and public-index edit bugs, comments locked to the owner, own-photo loading without `getFile` on every file, login copy that does not recommend an ACP host, and the dead directory removed. UX redesign waits until that PR is green.
