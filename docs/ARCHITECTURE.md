# Architecture

Podsta is a static React app. After sign-in, the browser talks to Solid Pods with `@inrupt/solid-client` and `@inrupt/solid-client-authn-browser`. There is no Podsta API.

The stack is React 18, React Router 6, Vite 5, and Tailwind 3. Routes live in `src/lib/navigation.js`: `/` (Home), `/discover`, `/profile`, `/people?webid=`, `/post?url=`, `/start`, `/invite`, `/notifications`, `/saved`.

GitHub Pages serves the production build at `/Podsta/`. Vite's `base` is `/Podsta/` only in that workflow (`PAGES_BASE`). The router basename, the manifest `start_url` and `scope`, and asset URLs follow that base. Unknown paths use a copy of `index.html` named `404.html`. `/start/` is its own file so the guide returns 200. The Solid client id document is `solid-client-id.json` on that origin, and sign-in there always returns to `https://teebooted.github.io/Podsta/`. Local development and CI stay at `/`.

## Pod layout

Paths are relative to the Pod root (`src/lib/vocab.js`).

```
<pod>/
  inbox/                              # the server's ldp:inbox, not a Podsta folder
  podsta/
    photos/
      <timestamp>-<name>              # image bytes
      <timestamp>-<name>.meta         # caption for an older single-file photo
    posts/
      <timestamp>-<id>.ttl            # a text post, or a photo album
    comments/
      <hash>.ttl                      # older owner-only notes, still private
    comment-sets/
      <hash>.ttl                      # comments the author publishes, same audience as the post
    my-comments.ttl                   # comments this person wrote, private
    comment-hides.ttl                 # comment ids the author removed, private
    blocks.ttl                        # WebIDs the author blocked, private
    reports.ttl                       # private notes about a comment
    like-sets/
      <hash>.ttl                      # who liked one post, same audience as the post
    contacts/
      friends.ttl                     # people you follow
      group.ttl                       # vcard:Group of approved contacts
    avatars/
    profile.ttl                       # name, bio, avatar, discoverability
    listing.ttl                       # public profile card, only when Public
    public-index.ttl                  # public posts, world-readable
    contacts-index.ttl                # contacts-only posts
    likes.ttl                         # this person's likes, private
    favorites.ttl                     # saved post URLs, private, no copied content
    contact-requests.ttl              # requests this person sent, world-readable
```

`podsta/inbox/` is a name in `vocab.js`. The app does not write it. Notices go to the Pod server's inbox, `{pod}inbox/`.

`podsta/favorites.ttl` is the signed-in person's private saved-post list. Each row is a post URL and a `schema:dateCreated` for when it was saved. The file does not copy captions or image bytes. The ACL is owner-only. Opening Saved reads each URL with the current session. A 401, 403, or missing post is shown as unavailable, without the text or the photo. A failed read of the list is not treated as an empty list, so a later save cannot wipe bookmarks that were not loaded.

### Posts

A text post is Turtle at `podsta/posts/<id>.ttl` with `schema:articleBody`, an optional `schema:name`, and `schema:dateCreated`.

A new photo post, including a single photo, is an album. The Turtle file has `podsta:PostType "photo"`, an optional `schema:caption`, and one `schema:image` per picture. Each photo can also have a description (`schema:description` on that image's URL inside the same file), at most 200 characters. The description uses the post's audience. The shared index repeats it as `podsta:imageAlt` only when the post itself is in that index. It is separate from the caption. An empty description is omitted. The bytes are PUT to `podsta/photos/` with `If-None-Match: *`. Up to 10 images, 10 MB each, JPEG, PNG, GIF, or WebP. Rotate, zoom, a square or 4:5 crop, brightness, warmth, or a look saves a redrawn photo. An untouched GIF stays a GIF. The look is not stored as a separate setting. It is already in the pixels.

Older single-file photos are still a binary under `podsta/photos/` plus an optional `.meta` caption. The feed treats a photo Turtle file as an album and a bare image URL as one picture.

Captions are at most 280 characters. Text posts are at most 5,000. Comments are at most 500.

An Instagram import stores `podsta:importedFrom` on the post. The value is a stable key for that Instagram post, so the same export is not saved twice. `schema:dateCreated` is the original post time. The photo bytes are redrawn before upload, the same as any other photo, so camera location is not stored.

A hashtag is a `#` plus up to 40 letters, numbers, or underscores, inside a caption or a note. At most eight unique tags are kept. The public or contacts index stores them as `schema:keywords`, taken from the full note, so a tag past the 200-character excerpt still matches. Private posts are not written into either index. `/tag?name=` lists the viewer's own posts with that tag, including private ones, plus index entries from people they follow. It does not search other Pods.

### Indexes

Most Pod servers will not list a container to the public, so Podsta does not discover posts that way.

`public-index.ttl` lists each public post with type, date, title, caption, and, for an album, the image URLs. The file is world-readable. `contacts-index.ttl` is the same shape for Contacts posts and is readable by the contacts group. Reads use `cache: 'no-store'` so a poll does not reuse a stale copy.

Home loads each followed person's public index, and their contacts index when this viewer can read it. One slow Pod does not hide the others. A cross-pod read gives up after 8 seconds.

### Listing, follow list, and contacts

`profile.ttl` stores discoverability: `hidden` (the default), `contacts`, or `public`.

`listing.ttl` is a public card (profile URL and name). It is published only at Public, and removed when you leave Public. Raising the level does not publish posts that were Only me. Lowering it rewrites anything more open than the new ceiling.

`friends.ttl` is the list of people you follow. It is world-readable only when the profile is Public. Following someone fills your feed. It does not let them see your posts. An invite link follows that person after sign-in and sends a contact request. Home shows their public posts only. A Hidden or Contacts profile stays private. Undo removes the follow and the request stored on your pod.

`contacts/group.ttl#contacts` is a `vcard:Group`. Approving a contact request adds their WebID there. Community Solid Server checks that file as the requester, so the group document is world-readable whenever an ACL points at it: the profile is Contacts, or any post is shared with Contacts. Membership is not a secret in those cases. A Hidden profile with no Contacts posts keeps the group private.

### Likes

`podsta/likes.ttl` is the liker's private list. A missing file is created with `If-None-Match: *` so a CORS failure is not treated as an empty list and then overwritten. A 401 or 403 is a failed read.

The author publishes `podsta/like-sets/<hash>.ttl` with the same audience as the post. The count and the names come only from that file. Until it is readable, the button can show that you liked it without inventing a total.

Someone who is not the author POSTs a `podsta:Like` notice to `{ownerPod}inbox/`. The author's app merges those notices the next time it loads their posts. A later `remove` drops that person. The hash is the same djb2 of the post URL used for comments, written in base 36.

### Comments

A comment is stored in the commenter's Pod at `podsta/my-comments.ttl`, which stays private. The commenter can edit or delete their own rows. They POST a `podsta:Comment` notice to `{authorPod}inbox/` with the text and `add`, `edit`, or `remove`. That notice does not grant them write access to the author's Pod.

The author's app copies notices into `podsta/comment-sets/<hash>.ttl` and gives that file the same audience as the post. Until that copy exists, other people do not see the comment. The commenter still sees their own copy, with a line that it is not on the published list. A missed inbox post says so. It is not described as delivered.

Hide adds the comment id to the private `podsta/comment-hides.ttl` and drops the text from the published file. A later copy of the original notice does not bring it back.

Block stores the WebID in private `podsta/blocks.ttl`. The author's app then leaves that person out of published comment lists and like lists. Report appends a private note in `podsta/reports.ttl`. There is no Podsta server to send a report to.

Names come from `podsta/profile.ttl` only when that file is readable. Otherwise the row shows the handle derived from the WebID.

Older notes in `podsta/comments/<hash>.ttl` stay owner-only. The author's next check copies them into the published list, so they still show. The comments container never receives a public Append grant.

The notification check merges inbox notices before it reads those published lists, so a new comment can light the badge while the author's tab is open.

### Contact requests

The sender writes `podsta/contact-requests.ttl` and makes it world-readable, then tries an authenticated POST to the recipient's `{pod}inbox/`. The recipient sees the request by reading people they follow, and by reading their own inbox. A request from someone they do not follow shows up only if the inbox post landed. Anonymous inbox posts on solidcommunity.net are rejected.

Approve adds the person to the contacts group, then POSTs an approval notice to the requester's inbox.

## Access rules

Podsta writes WAC Turtle at `<resource>.acl`. Templates are in `src/lib/aclTurtle.js`. A share applies the same audience to every sibling URL (the post, each image, a caption sidecar). If one sibling fails, the share fails. The UI does not say "Posted publicly" when sharing failed.

| Discoverability | Profile and listing | Follow list | Contacts group file | Posts you may create |
| --- | --- | --- | --- | --- |
| Hidden (default) | Private. No listing. | Private | Private, unless a post is already shared with Contacts | Only me |
| Contacts | Not listed | Private | World-readable, because the server reads it to check membership | Only me, or Contacts |
| Public | `profile.ttl` and `listing.ttl` world-readable | World-readable | World-readable only if some post uses Contacts | Only me, Contacts, or Public |

| Post audience | Who can read the post and its index entry |
| --- | --- |
| Only me | Owner. Not listed in either index. |
| Contacts | Members of `group.ttl#contacts`. Listed in `contacts-index.ttl`. |
| Public | Anyone. Listed in `public-index.ttl`. |

New resources on Community Solid Server inherit the parent ACL. Podsta still writes an explicit `.acl`. A failed ACL write after a private likes file is saved does not pretend the like was lost. The parent rule on this host stays owner-only until the ACL write succeeds.

## Outbox

A post, like, or comment that cannot reach the pod is stored in this browser (IndexedDB, database `podsta-outbox`). The banner says it is waiting to send. Coming back online sends the queue, oldest first. A post keeps a stable id so a retry writes the same pod URLs, and photos that already landed are not sent again. There is still no Podsta server.

## Notifications

There is no Podsta notification server. While the tab is visible, `useNotificationFeed` polls about every 45 seconds (`POLL_BASE_MS`). A failed check doubles the wait, up to five minutes. A hidden tab pauses. The bell is in the header, not a fifth phone tab.

Each check looks at:

- public posts of up to 40 people you follow (30 posts)
- comments on your 15 newest posts, and only comments whose author is a different WebID
- contact requests on Pods you follow, plus the latest 15 resources in your server inbox, including likes and contact notices in those resources
- approvals, when their contacts group lists you or an approval notice arrived

The first check that can see anything is a baseline: those items are marked seen, so history does not light the badge. A check that fails completely is not a baseline. A later item still lights it. A partial failure keeps items the previous check already showed.

Seen state is `localStorage`, key `podsta.notifications.seen:<encoded WebID>`. Mark as read clears the badge. Opening the page does not. Another browser starts again.

After a person posts, follows, likes, or comments, Podsta can ask once to use notifications on this device. Agreeing opens the browser's permission dialog. From then on, the same poll sets the installed app's badge from the unseen count and sends a notification for a new comment, like, or contact request. The first batch already on screen is marked quiet, so turning it on does not repeat history. A hidden tab still pauses the poll. There is no push server.

A Solid streaming channel, when the provider accepts the session, only wakes a poll. It does not invent a notification. On solidcommunity.net the subscription returned HTTP 400, so the page stays on the polling sentence and does not claim a live channel. If a channel does connect, the timer slows to three minutes. The poll is still the source of truth.

## Privacy and security

These limits are part of the design, not temporary bugs.

- The WebID document is hosted by the identity provider. Hidden does not make it private. It is usually world-readable. Anyone who already has the URL can read the address.
- While Contacts is in use, `podsta/contacts/group.ttl` is world-readable. The Pod server reads it as the requester. The posts themselves stay limited to members.
- `contact-requests.ttl` is world-readable. The fact of a request is not treated as secret.
- The comments container stays owner-only. Other people never get write access to the author's Pod. A published comment list is readable only at the post's audience. Blocks, reports, hides, and the commenter's own file are private.
- Likes in `podsta/likes.ttl` are private. Publishing a count is a separate file with the post's audience.
- Saved posts in `podsta/favorites.ttl` are private. Saving does not copy the post and does not write the author's Pod.
- Share uses the device share sheet or the clipboard. A private post is not shared. A contacts post shares the Podsta link and not the caption. A public post may include a short excerpt that is already world-readable.
- Notification seen-state is per browser. It is not in the Pod.
- The session from `@inrupt/solid-client-authn-browser` is in `localStorage`. An XSS would be a Pod takeover. Captions, comments, names, and bios are stored and shown as plain text. Tags are removed before they are written. There is no `dangerouslySetInnerHTML`.
- Pod URLs and identity-provider issuers have to be https. `http://localhost` and `http://127.0.0.1` are the only exceptions. `javascript:` and URLs with a username or password are rejected. Image addresses in an index are dropped unless they pass the same check.
- The production build sends a Content-Security-Policy. Scripts come from this origin. `vercel.json` also sets `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a strict referrer policy. GitHub Pages cannot set those headers, so the policy is a meta tag there. Fonts are files in the build, not a request to another site. The Pages build only allows https. The local and CI preview also allows `http://localhost` and `http://127.0.0.1`, so a Community Solid Server on this machine can be used. CI starts that server and signs in two accounts.
- The Solid client refreshes the session when the provider issued a refresh token (`offline_access`). When that fails, the app says the sign-in expired and keeps the posts it already saved on this device.
- ACL Turtle escapes IRIs. A `>` in a WebID must not close the IRI.
- JPEG, PNG, and WebP uploads are redrawn in the browser before they are stored. The camera orientation is baked into the pixels, and so is any look, crop, brightness, or warmth chosen in the composer. EXIF and GPS are not uploaded. An animated GIF that already fits, and was left as shot, is stored as a GIF. The feed uses a JPEG thumbnail when one was uploaded.
- There is no central directory and no handle registry. `@ada` means `@ada` on solidcommunity.net. The invite link carries the full WebID, which is the identifier.

## Pod providers

| Provider | Access control | Podsta |
| --- | --- | --- |
| solidcommunity.net (Community Solid Server) | WAC | Recommended. Sign-up and sharing were exercised here. |
| solidweb.org (NSS) | WAC | Offered as another host. Sharing uses the same `.acl` files. |
| Inrupt PodSpaces | ACP | Not supported. A `.acl` file there does not grant Read. The login screen says so and does not recommend it. |

ACP support would be a separate project. The Inrupt client has helpers, and they do not match these Turtle templates.
