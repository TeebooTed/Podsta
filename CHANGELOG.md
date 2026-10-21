# Changelog

Dates are the days the work landed on `main`.

## 21 October 2026

- A return visit reloads when a new service worker takes over, and an open tab checks for that update when it becomes visible again. The app shell still opens with the network off.
- The theme script stays blocking so the first paint has the right colors, and it now runs after the stylesheet and app module are already discovered.
- The photo viewer, the invite QR code, and Instagram import load when they are opened. The like confetti stays a few CSS dots on the landing hero, not a separate library.
- Create my Pod still opens Solid Community in one tap, and the landing page says to create the pod before Continue authentication, then come back and tap Sign in. Continuing first leaves the new account with no address, and Solid Community does not send you back on its own.
- Starter packs. Profile can save up to 50 addresses in a public file in your pod and share that file with a link or a QR code. Opening it shows those people, with Follow all and a follow button for each one. There is no central directory.
- A weekly photo prompt on Home, such as Something green. It shows only when someone you follow posted in the last seven days. Not this week hides it on this device until next week. There is no extra notification.
- Sign in with your account. The sign-in card says "Your account" and accepts a name like @ada or @ada@solidweb.org. That name only chooses the host. It is not looked up, and there is no registry. A blank name still opens Solid Community.
- One-tap photo looks in the new-post window: Cream, Sunshine, Coral, Berry, Plum, Mint, and Soft, each with a live thumbnail. Square or 4:5, brightness, and warmth are drawn into the photo on this device. As shot still posts in the same few taps. Camera location is still removed, and an untouched GIF still stays a GIF.
- One-tap photo filters: Original, Warm, Fade, Mono, Cool, and Punch. The choice is drawn into the photo in the browser before it is uploaded. Camera location is still removed.
- **Create my Pod** is the one-tap default on the signed-out page. It opens Solid Community. Sign-in for an account you already have stays on the page, and other pod hosts stay under Advanced.
- An invite also connects both ways. The new person approves the inviter as a contact and posts a notice to the inviter's inbox. The inviter's app follows back and approves the new person. Nothing is written into the other person's pod except that inbox notice.
- An invite link or QR code follows that person after sign-in and sends a contact request. Home shows their public posts. A private profile stays private. Undo is on Home.
- Like counts are private by default. Other people can still like a post, and you can see your own count. Turn on "Show like counts" on your profile to publish the number with the post's audience. The home feed stays newest first.
- After you post, follow, like, or comment, Podsta can ask to show notifications on this device. The badge and the notices cover new comments, likes, and contact requests from the same check the app already runs. There is no push server.
- CI signs two test accounts into a local Community Solid Server and checks posting for Only me, Contacts, and Public, plus follow, contacts-only visibility, a comment, a like, and notifications between them.
- Posts, likes, and comments wait on this device when the pod is unreachable or the browser is offline, then send when the connection returns. The caption and photos from a failed upload stay until they are sent or discarded.
- Instagram import on Profile. A signed-in person can choose Instagram's JSON zip or unzipped folder, preview the posts, and save the ones they pick. Dates and captions stay, camera location is removed, and the audience starts as Only me. Posts already in the pod are skipped, and a stopped import can continue.
- Installable production build. A service worker caches the app shell, and the feed and your own posts are saved on this device when a Pod does not answer.
- Photos are resized before upload. A thumbnail is what the feed and the profile grid request. JPEG, PNG, and WebP are re-encoded in the browser so camera metadata is not stored.
- Captions, comments, names, and bios are plain text. Pod and provider addresses have to be https. The production build sets a Content-Security-Policy.
- The signed-out page does not download the Solid client until sign-in. Fonts ship with the app.
- GitHub Pages deploy runs the tests before it publishes. The public URL is `https://teebooted.github.io/Podsta/`, with a canonical link, share image, sitemap, and `/start/` as a real page. Sign-in on that origin returns to the home URL.
- Photo uploads bake the camera orientation into the pixels and do not store EXIF or GPS.
- The install icons, favicon, and share image come from the brand kit. The manifest theme is Plum `#2B1B3D` and the splash background is Cream `#FFF7EE`.
- New look from the brand kit in `brand/`: Cream and Plum with Coral, Berry, Sunshine and Mint, Fredoka headings and Nunito text, and the pea-pod logo. Light by default. Dark follows the system, and Auto, Light or Dark can be picked from the account menu. The bundled fonts are now Fredoka and Nunito, Latin and Latin Extended only. Text colors meet WCAG AA in both themes.

## 21 October 2026

- Photo descriptions. Each picture can have alt text, stored with the photo and shared only at the post's audience. It is separate from the caption. The composer asks for it, and the editor can change it. If the browser refuses a streamed upload, the same file is sent as a normal request so the photo still reaches the Pod.
- Share a public post, or the link to a contacts post, with another app on this device. A private post is not offered, and a contacts caption is not put in the share sheet.
- Hashtags in captions and notes. `/tag?name=` shows your own posts with that tag, including private ones, and posts from people you follow that you can already read. Tags are stored on the shared index only when the post itself is shared. There is no central tag directory.
- Saved posts. The private file `podsta/favorites.ttl` stores the post URL and the time it was saved. It does not copy the photo or the caption. Home, profile, and the post page can save or forget a post. `/saved` shows what this session can still read, and says when a post is no longer available. A failed read does not replace the list.

## 10 October 2026

- Public site at https://teebooted.github.io/Podsta/. GitHub Pages builds with base `/Podsta/` and a `404.html` fallback so invite and post links work. Sign-in on that origin uses a static Solid client id and returns to the home URL. The signed-out home explains Podsta and shows screenshots before login. Any Web Access Control provider can be entered.
- Comments from other people. The comment is stored in the commenter's Pod. An inbox notice tells the author, who publishes a per-post list with the same audience as the post. The author can hide a comment or block a WebID, which also drops that person's likes from published lists. The commenter can edit or delete their own. Older owner-only notes are copied onto that list the next time the author's app checks. The comments folder stays owner-only.
- Notifications in the header and on `/notifications`: new posts from people you follow, comments on your posts from another WebID, and contact requests or approvals. The app polls. Seen state stays in this browser. A flaky check no longer wipes the list or hides the next post. Index reads skip the browser cache.
- Photo albums of up to ten pictures, with a carousel, crop and rotate, desktop drop, upload progress, and retry after a failed photo. The viewer no longer crashes on open.
- Likes in the liker's private `podsta/likes.ttl`. The author publishes a per-post list with the post's audience. Inbox notices use the Community Solid Server listing form, so a like can be merged and then dropped.
- Sign-up guide at `/start` for Solid Community, plus invite links and a QR code. `@ada` is a display handle, not a registry entry. Solid sign-in keeps the new WebID.
- Discoverability saves retry a rate-limited Pod instead of failing on the first miss.

## 9 October 2026

- Audit and the plan in `docs/IMPROVEMENT_PLAN.md`. The app boots again.
- Phase 1: WAC sharing that fails closed, owner-only comments, private by default, public and contacts indexes, CI, and an honest empty Discover page. Solid Community is the recommended host. Inrupt PodSpaces is not.
- Phase 2: Home is the following feed, Profile is the grid, phone bottom navigation, real routes, a skippable first-run tour, and contrast fixes on the actions people actually use.
- Hidden, Contacts, or Public discoverability, with a ceiling on each post. Contacts are an approved group, not everyone you follow.
