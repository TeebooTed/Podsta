# Contributing

Podsta is a static React app. Changes are reviewed as pull requests. There is no Podsta server to deploy with the UI.

## Setup

Use Node.js 22, the version in CI.

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. Solid's OIDC redirect is registered for `localhost`. `127.0.0.1` will not finish sign-in.

## Checks

CI runs these on every push and pull request (`.github/workflows/ci.yml`):

```bash
npm run lint
npm test
npm run build
```

`npm test` is `node --test tests/*.test.js`. It does not start a browser and it does not need a Pod. Add a unit test when you change ACL Turtle, WebID handling, indexes, notifications, likes, or upload progress.

Lint is `eslint src`. Warnings do not fail the run. A production build that fails does.

## What to keep true

- New posts stay private unless the person picks Contacts or Public, and that choice cannot be more open than the profile.
- Do not grant public Append on `podsta/comments/`. Comments stay owner-only until there is a model that does not let strangers write the owner's Pod.
- Sharing writes WAC `.acl` files. Do not mark Inrupt PodSpaces as recommended while those files are the only access rules.
- Do not add a handle registry. Display names like `@ada` are derived from the WebID.
- Do not describe Podsta as an installable PWA. The manifest is a stub and there is no service worker.
- Do not commit Pod passwords, refresh tokens, or real WebIDs from a private test session unless they are already public test accounts and the password stays out of the diff.

## Docs

If a change alters the Pod layout, an access rule, or a screen a person sees, update `README.md` and `docs/ARCHITECTURE.md` in the same pull request. User-facing work from a session belongs in `CHANGELOG.md`.
