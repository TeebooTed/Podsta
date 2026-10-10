# Changelog

Dates are the days the work landed on `main`. This covers 9–10 October 2026.

## 10 October 2026

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
