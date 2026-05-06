# Podsta

> Your posts. Your Pod. Your rules.

A fully decentralized social network for **text posts and photos** built on [Solid Pods](https://solidproject.org). No central server, no algorithms, no surveillance. Your data lives in your Pod — you decide what's public, what's private, and you can leave any time.

This is a complete rebuild of the [original Podsta MVP](https://github.com/TeebooTed/Podsta) with full multi-user support, text posts, cross-pod feeds, and a polished editorial UI.

---

## Features

- **Photo posts** with captions and a full-screen lightbox viewer (zoom, swipe, pinch).
- **Text posts** with optional titles and read-more truncation.
- **Public/private toggle** per post, applied via WACL ACLs to the post and its sibling resources.
- **Cross-pod feeds** — see your friends' public posts via a `public-index.ttl` discovery file.
- **Comments** on public posts, stored in the post owner's Pod.
- **Discovery** through three channels: manual WebID, friends-of-friends, and a community registry.
- **Profile editor** — name, bio, avatar.
- **Keyboard shortcuts**: `h`/`f`/`d`/`p` for tabs, `n` for new post.
- **Mobile-first** responsive layout with bottom tab bar and floating compose button.
- **PWA-ready** — installable manifest.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:5173 and sign in with any Solid Pod provider.
```

To build for production:

```bash
npm run build
npm run preview   # smoke-test the production bundle locally
```

The contents of `dist/` are a static site — deploy to Vercel, Netlify, GitHub Pages, or any static host.

---

## How it works

### Data model

Every Podsta user owns a Solid Pod. Inside it, the app uses these paths:

```
<pod>/
  podsta/
    photos/
      1729872398-photo.jpg          # binary photo
      1729872398-photo.jpg.meta     # caption metadata (Turtle)
      1729872398-photo.jpg.acl      # access control (when public)
    posts/
      1729872398-abc123.ttl         # text post (Turtle)
    comments/
      8x4kfm.ttl                    # comments file per-post (hashed URL)
    contacts/
      friends.ttl                   # WebIDs of people I follow
    avatars/
      avatar-1729872398.jpg         # profile picture
    profile.ttl                     # name, bio, avatar URL
    public-index.ttl                # 🔑 list of all my public posts
```

### The `public-index.ttl` pattern

The original Podsta MVP tried to enumerate friends' photos by listing each pod's `/photos/` container — but most Pod servers don't expose container listings publicly, so feeds couldn't actually load anyone's posts.

Podsta solves this with a single Turtle file per user, `public-index.ttl`, that **lists the URLs of all their public posts** with denormalized metadata (type, title, caption, timestamp). Every time you share a post, we add an entry; every time you unshare or delete, we remove it. The file itself is publicly readable, so any visitor — authenticated or not — can fetch it and discover what to load.

Friend feeds become a parallel fetch of N small Turtle files instead of N container listings (which don't work) followed by N×M individual file fetches (which is slow).

### Sharing & ACLs

When you mark a post public, we write a Turtle ACL granting `acl:Read` to `foaf:Agent` (the public class) on:

- The post resource itself
- For photos, the `.meta` sidecar with the caption
- The comments container is set to public Read+Append once with a `default` cascade rule, so comment files inherit it automatically

Unsharing reverses these grants and removes the entry from the public index.

### Comments

Comments live in the post owner's Pod, not the commenter's, so they persist if a commenter deletes their account. Each post has one Turtle file at `/podsta/comments/<hash>.ttl` containing all its comments as separate `Thing`s. The container has a public Read+Append ACL (set the first time you share any post), which means anyone can post a comment but only the owner can delete or modify them.

### Discovery

Three layers, all in `src/lib/discover.js`:

1. **Manual WebID** — paste any Solid WebID URL.
2. **Friends-of-friends** — for each friend whose `friends.ttl` is public, harvest WebIDs you don't already follow.
3. **Community registry** — a JSON file at `https://cdn.jsdelivr.net/gh/podsta-app/registry@main/registry.json` listing opt-in profiles. Cached for 1 hour in localStorage. Falls back to bundled seed list if unreachable.

To set up your own registry, fork [podsta-app/registry](https://github.com/podsta-app/registry) (you'll need to create this) and edit `REGISTRY_URL` in `src/lib/discover.js`.

---

## Project structure

```
src/
  App.jsx                       # Top-level orchestrator
  main.jsx                      # ReactDOM mount
  components/
    Avatar.jsx
    CommentsDrawer.jsx
    Composer.jsx                # Unified text+photo composer modal
    EditPostModal.jsx
    EmptyState.jsx
    Header.jsx
    Lightbox.jsx
    Modal.jsx
    PostCard.jsx                # Renders both photo and text posts
    SkeletonCard.jsx
    Toast.jsx
  lib/
    acl.js                      # WACL Turtle templates
    auth.js                     # Solid OIDC wrapper
    comments.js
    discover.js                 # 3-tier discovery
    feed.js                     # Cross-pod friend feed loader
    friends.js                  # Social graph in friends.ttl
    posts.js                    # Photo + text post CRUD
    profile.js                  # Name, bio, avatar
    publicIndex.js              # 🔑 The public-index.ttl pattern
    utils.js                    # Formatters
    vocab.js                    # RDF predicates + paths + limits
  pages/
    DiscoverPage.jsx
    FeedPage.jsx
    HomePage.jsx
    LoginPage.jsx
    ProfilePage.jsx
  styles/
    index.css                   # Tailwind + custom design tokens
```

---

## Design

The visual aesthetic is intentionally editorial and warm — closer to a print magazine than a typical "AI-built" web app. Highlights:

- **Typography**: Fraunces (display serif) + Manrope (body sans) + JetBrains Mono (IDs).
- **Palette**: Warm dark base (`ink-*` from cream-paper to near-black) with a single sharp accent (`#e85d3c`) and a "live" signal green (`#6ee7b7`) reserved for public-status indicators.
- **Texture**: Subtle film-grain overlay and soft radial gradient on the body for atmosphere.
- **Motion**: Restrained — fade-ins, slide-ups, and shimmer skeletons. No jittery animations.

All design tokens live in `tailwind.config.js` and `src/styles/index.css`.

---

## Deployment

### Vercel (recommended)

The repo includes `vercel.json` that rewrites all routes to `/` (since this is a SPA). Deploy with:

```bash
npx vercel --prod
```

### Static hosting

Run `npm run build` and deploy `dist/` anywhere. Configure your host to serve `index.html` for unknown routes.

### Important: HTTPS only

Solid OIDC requires HTTPS in production. Localhost works for development, but anywhere else needs a TLS certificate.

---

## Roadmap / Known limitations

- **No "feed since" timestamps** yet — the feed re-fetches each pod's full index on tab open. For users with many friends, an LRU cache or per-pod ETag check would help.
- **Comments are flat** — no threading or replies. Each post has one Turtle file; switching to one-file-per-comment would enable individual deletion/moderation.
- **No notifications** — you don't know when someone comments on your post unless you check. Solid LDN inbox could solve this; not yet wired up.
- **No like/reaction primitive** — by design for now (less performative pressure on a slow social network).
- **Pod-server quirks** — different Solid servers (NSS, ESS, CSS) implement ACL slightly differently. The hand-written Turtle ACLs work on all three in our testing, but if your provider behaves oddly, file an issue.

---

## License

MIT — do whatever you want with it.

## Credits

Built on top of [`@inrupt/solid-client`](https://docs.inrupt.com/developer-tools/javascript/client-libraries/) and the [Solid Project](https://solidproject.org). Inspired by the original [Podsta MVP](https://github.com/TeebooTed/Podsta).
