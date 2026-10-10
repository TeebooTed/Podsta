# Architecture

Podsta is a static React app. After sign-in, the browser talks to Solid Pods with `@inrupt/solid-client` and `@inrupt/solid-client-authn-browser`. There is no Podsta API.

The stack is React 18, React Router 6, Vite 5, and Tailwind 3. Routes live in `src/lib/navigation.js`: `/` (Home), `/discover`, `/profile`, `/people?webid=`, `/post?url=`, `/start`, `/invite`, `/notifications`.

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
    contact-requests.ttl              # requests this person sent, world-readable
```

`podsta/inbox/` and `podsta/favorites.ttl` are names in `vocab.js`. The app does not write them. Notices go to the Pod server's inbox, `{pod}inbox/`.

### Posts

A text post is Turtle at `podsta/posts/<id>.ttl` with `schema:articleBody`, an optional `schema:name`, and `schema:dateCreated`.

A new photo post, including a single photo, is an album. The Turtle file has `podsta:PostType "photo"`, an optional `schema:caption`, and one `schema:image` per picture. The bytes are PUT to `podsta/photos/` with `If-None-Match: *`. Up to 10 images, 10 MB each, JPEG, PNG, GIF, or WebP. Rotate or zoom saves a JPEG. An untouched GIF stays a GIF.

Older single-file photos are still a binary under `podsta/photos/` plus an optional `.meta` caption. The feed treats a photo Turtle file as an album and a bare image URL as one picture.

Captions are at most 280 characters. Text posts are at most 5,000. Comments are at most 500.

### Indexes

Most Pod servers will not list a container to the public, so Podsta does not discover posts that way.

`public-index.ttl` lists each public post with type, date, title, caption, and, for an album, the image URLs. The file is world-readable. `contacts-index.ttl` is the same shape for Contacts posts and is readable by the contacts group. Reads use `cache: 'no-store'` so a poll does not reuse a stale copy.

Home loads each followed person's public index, and their contacts index when this viewer can read it. One slow Pod does not hide the others. A cross-pod read gives up after 8 seconds.

### Listing, follow list, and contacts

`profile.ttl` stores discoverability: `hidden` (the default), `contacts`, or `public`.

`listing.ttl` is a public card (profile URL and name). It is published only at Public, and removed when you leave Public. Raising the level does not publish posts that were Only me. Lowering it rewrites anything more open than the new ceiling.

`friends.ttl` is the list of people you follow. It is world-readable only when the profile is Public. Following someone fills your feed. It does not let them see your posts.

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

## Notifications

There is no Podsta notification server. While the tab is visible, `useNotificationFeed` polls about every 45 seconds (`POLL_BASE_MS`). A failed check doubles the wait, up to five minutes. A hidden tab pauses. The bell is in the header, not a fifth phone tab.

Each check looks at:

- public posts of up to 40 people you follow (30 posts)
- comments on your 15 newest posts, and only comments whose author is a different WebID
- contact requests on Pods you follow, plus the latest 15 resources in your server inbox
- approvals, when their contacts group lists you or an approval notice arrived

The first check that can see anything is a baseline: those items are marked seen, so history does not light the badge. A check that fails completely is not a baseline. A later item still lights it. A partial failure keeps items the previous check already showed.

Seen state is `localStorage`, key `podsta.notifications.seen:<encoded WebID>`. Mark as read clears the badge. Opening the page does not. Another browser starts again.

A Solid streaming channel, when the provider accepts the session, only wakes a poll. It does not invent a notification. On solidcommunity.net the subscription returned HTTP 400, so the page stays on the polling sentence and does not claim a live channel. If a channel does connect, the timer slows to three minutes. The poll is still the source of truth.

## Privacy and security

These limits are part of the design, not temporary bugs.

- The WebID document is hosted by the identity provider. Hidden does not make it private. It is usually world-readable. Anyone who already has the URL can read the address.
- While Contacts is in use, `podsta/contacts/group.ttl` is world-readable. The Pod server reads it as the requester. The posts themselves stay limited to members.
- `contact-requests.ttl` is world-readable. The fact of a request is not treated as secret.
- The comments container stays owner-only. Other people never get write access to the author's Pod. A published comment list is readable only at the post's audience. Blocks, reports, hides, and the commenter's own file are private.
- Likes in `podsta/likes.ttl` are private. Publishing a count is a separate file with the post's audience.
- Notification seen-state is per browser. It is not in the Pod.
- The session from `@inrupt/solid-client-authn-browser` is in `localStorage`. An XSS would be a Pod takeover. The UI renders text as text. There is no `dangerouslySetInnerHTML`.
- `vercel.json` sends a Content-Security-Policy (`frame-ancestors 'none'`, scripts from `'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a strict referrer policy. Fonts still load from Google Fonts, which the policy allows.
- ACL Turtle escapes IRIs. A `>` in a WebID must not close the IRI.
- Public photos are stored as uploaded. Podsta does not strip EXIF. A public JPEG can still contain a location.
- There is no central directory and no handle registry. `@ada` means `@ada` on solidcommunity.net. The invite link carries the full WebID, which is the identifier.

## Pod providers

| Provider | Access control | Podsta |
| --- | --- | --- |
| solidcommunity.net (Community Solid Server) | WAC | Recommended. Sign-up and sharing were exercised here. |
| solidweb.org (NSS) | WAC | Offered as another host. Sharing uses the same `.acl` files. |
| Inrupt PodSpaces | ACP | Not supported. A `.acl` file there does not grant Read. The login screen says so and does not recommend it. |

ACP support would be a separate project. The Inrupt client has helpers, and they do not match these Turtle templates.
