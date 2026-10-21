# Podsta discoverability audit (read-only)
Date: 21 Oct 2026, 10:15 AM (America/Phoenix). Evidence files are in `/workspace/podsta/seo/raw/`.

## Summary
1. **The live site does not exist yet.** https://teebooted.github.io/Podsta/ (and `/podsta/` and the bare host) return GitHub's "There isn't a GitHub Pages site here" 404. The API call `GET /repos/TeebooTed/Podsta/pages` also returns 404, and `has_pages` is false. Nothing on the live site can be crawled, so I couldn't run PageSpeed/Lighthouse.
2. **The repo is built for Vercel at a root path, not GitHub Pages at `/Podsta/`.** `vercel.json` has the SPA rewrite and security headers. In `vite.config.js` `base` isn't set, `index.html` and `manifest.json` use root-absolute paths (`/favicon.svg`, `/manifest.json`, `start_url: "/"`), `BrowserRouter` has no `basename`, and the Solid login redirect is `${origin}/`. On a project Pages site, every one of those points at `teebooted.github.io/` and breaks.
3. **Head tags (from `index.html` in the source):** title, description, `og:title`, `og:description` and `og:type` are present, and `lang="en"` is set. Missing: canonical, `og:url`, `og:image`, all Twitter tags, apple-touch-icon, JSON-LD, and a no-JS fallback (`<div id="root"></div>` only).
4. **Repo metadata (from the API):** description "Instagram for Solid Pods", **homepage empty**, **topics none**, MIT LICENSE present, **0 releases/tags**, 0 stars, last push 10 Oct 2026 (UTC). The social preview is GitHub's auto-generated card (opengraph.githubassets.com), not a custom image.
5. **The README is strong:** a pitch line, a features list, 8 screenshots, Solid explained, a quick start, dev commands, a license, and links to CONTRIBUTING and CHANGELOG. It is missing a **live demo link** and a hero GIF. It also says "Podsta is not an installable app. `public/manifest.json` is a stub", which matches the code.
6. **Listings:** the official catalog is https://solidproject.org/apps, added via a PR or issue on https://github.com/solid/solidproject.org (README: "please submit a pull request to this repository or open an issue"; last push 3 Oct 2026). The only live awesome list is https://github.com/kustomzone/awesome-solid (last push 9 Feb 2026, no CONTRIBUTING file). `solid/awesome-solid` returns 404. Show HN and Product Hunt both need a working URL people can try, so **they're blocked until hosting works**.

## Current state evidence
| Check | Result |
|---|---|
| Live URL | 404 "Site not found · GitHub Pages" |
| /Podsta/robots.txt, sitemap.xml, llms.txt, manifest.json, favicon.ico | all 404 (no site) |
| teebooted.github.io/robots.txt | 404. There's no `TeebooTed/teebooted.github.io` user-site repo (user repos: Podsta, starcardsite, uScrape) |
| Source `<title>` | "Podsta — your posts, your pod, your rules" (41 chars, fine) |
| Source meta description | "A decentralized social network for text and photo posts. You own your data. No algorithms. No surveillance." |
| canonical / og:url / og:image / twitter:* | missing |
| Icons | `/favicon.svg` only (root-absolute). No PNG and no apple-touch-icon |
| Manifest | name and short_name are "Podsta", `start_url "/"`, no `scope`, one SVG icon. README calls it a stub |
| JSON-LD | none |
| H1 | rendered by React only. No H1 in the static HTML |
| Repo topics / homepage / releases | none / empty / none |

## Prioritized fixes

### P1: get a crawlable live URL (everything else depends on this)
Choose **one**:
- **Option A, Vercel (the repo is already built for it):** deploy as is and put the Vercel URL (or a custom domain) in the repo's homepage field. This is the least work, and the CSP headers come along.
- **Option B, GitHub Pages at `/Podsta/`:** the following code changes are required:
  1. `vite.config.js`: add `base: '/Podsta/',`.
  2. `src/main.jsx`: `<BrowserRouter basename={import.meta.env.BASE_URL}>`.
  3. `src/lib/auth.js`: the redirect is `${origin}/`. It must become `${origin}${import.meta.env.BASE_URL}` (check `sameOriginRedirect` and any Client ID document for the same thing).
  4. `index.html`: change `/favicon.svg` and `/manifest.json` to relative `favicon.svg` and `manifest.json` (Vite rewrites them with `base`).
  5. SPA deep links (`/start`, `/invite?webid=`): Pages has no rewrites, so copy `dist/index.html` to `dist/404.html` in the build. Deep links will then load, but with a 404 status, which crawlers won't index. Only `/` and `/start` need to be indexable, so consider also emitting `dist/start/index.html`.
  6. Pages ignores `vercel.json`, so its headers (CSP, X-Frame-Options) are lost. Add a CSP `<meta http-equiv>` if that matters.
  7. Deploy with a workflow (`.github/workflows/pages.yml`):
```yaml
name: Deploy Pages
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build && cp dist/index.html dist/404.html
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.d.outputs.page_url }}" }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```
     Then go to Settings → Pages → Source and choose "GitHub Actions".
- Set the repo's **homepage** to the live URL (Settings → About, or `gh repo edit TeebooTed/Podsta --homepage <URL>`).

### P1: head tags (paste into `index.html`; replace `SITE` with the final URL, e.g. `https://teebooted.github.io/Podsta/`)
```html
<title>Podsta — your posts, your Pod, your rules</title>
<meta name="description" content="Podsta is a photo-and-text app that stores everything in your Solid Pod. No Podsta server, no central directory. Per-post audiences: Only me, Contacts, or Public." />
<link rel="canonical" href="SITE" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Podsta" />
<meta property="og:title" content="Podsta — your posts, your Pod, your rules" />
<meta property="og:description" content="A photo-and-text app that stores everything in your Solid Pod. No Podsta server." />
<meta property="og:url" content="SITE" />
<meta property="og:image" content="SITEog-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Podsta home feed with a two-photo post" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Podsta — your posts, your Pod, your rules" />
<meta name="twitter:description" content="A photo-and-text app that stores everything in your Solid Pod. No Podsta server." />
<meta name="twitter:image" content="SITEog-image.png" />
<link rel="icon" type="image/svg+xml" href="favicon.svg" />
<link rel="apple-touch-icon" href="apple-touch-icon.png" />
```
Add `public/og-image.png` (1200x630, absolute https URL as above). `docs/screenshots/home-desktop.png` is a good base. Also add `public/apple-touch-icon.png` (180x180) and `icon-192.png` / `icon-512.png`.

### P1: no-JS fallback (inside `<div id="root">`, React replaces it)
```html
<div id="root">
  <main>
    <h1>Podsta — your posts, your Pod, your rules</h1>
    <p>Podsta is a photo-and-text app that stores everything in your <a href="https://solidproject.org">Solid Pod</a>. There is no Podsta server and no central directory.</p>
    <p>New to Solid? The guide at <a href="start">/start</a> helps you create a Pod on Solid Community.</p>
    <p><a href="https://github.com/TeebooTed/Podsta">Source on GitHub</a> (MIT)</p>
    <noscript>Podsta needs JavaScript to sign in to your Pod.</noscript>
  </main>
</div>
```
(If using `createRoot(...).render`, the fallback is replaced cleanly.)

### P2: JSON-LD
```html
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Podsta",
 "url":"SITE","applicationCategory":"SocialNetworkingApplication","operatingSystem":"Any (web browser)",
 "description":"A photo-and-text app that stores everything in your Solid Pod. There is no Podsta server and no central directory.",
 "offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},
 "license":"https://opensource.org/licenses/MIT",
 "codeRepository":"https://github.com/TeebooTed/Podsta",
 "author":{"@type":"Person","name":"Matthew Nielsen"},
 "screenshot":"SITEog-image.png"}
</script>
```
Note: if the CSP stays at `script-src 'self'`, inline JSON-LD is fine, because CSP doesn't execute `application/ld+json` blocks.

### P2: manifest (`public/manifest.json`; the paths are relative so they work under `/Podsta/`)
```json
{
  "name": "Podsta",
  "short_name": "Podsta",
  "description": "Your posts. Your Pod. Your rules.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#1a1610",
  "theme_color": "#1a1610",
  "icons": [
    { "src": "favicon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```
(The README says Podsta is not installable and there is no service worker. That's fine, because the manifest is still used for names and icons.)

### P2: robots.txt and sitemap
- **GitHub Pages limitation:** crawlers only read `https://teebooted.github.io/robots.txt`. A `/Podsta/robots.txt` is ignored. Workarounds, best first:
  1. Use a custom domain (CNAME on the Pages site or Vercel). Then `/robots.txt` is at the root.
  2. Create a `TeebooTed/teebooted.github.io` user-site repo containing a root `robots.txt` (this governs all project sites under that host).
  3. Otherwise skip robots.txt (the default is allow-all) and submit the sitemap directly in Google Search Console (a URL-prefix property for `https://teebooted.github.io/Podsta/`) and Bing Webmaster Tools.
- `public/robots.txt` (effective at a root host):
```
User-agent: *
Allow: /
Sitemap: SITEsitemap.xml
```
- `public/sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>SITE</loc></url>
  <url><loc>SITEstart</loc></url>
</urlset>
```
(Leave `/invite` out because it's parameterized and personal.)

### P2: llms.txt (`public/llms.txt`, no email addresses)
```
# Podsta

> Your posts. Your Pod. Your rules. Podsta is a photo-and-text app that stores everything in your Solid Pod. There is no Podsta server and no central directory; the signed-in browser talks to Pods directly with Web Access Control.

- New profiles start Hidden; you choose Contacts or Public later. A post cannot be more open than the profile.
- Comments and likes live in the commenter's or liker's own Pod.
- Works with Pods that use Web Access Control (Solid Community recommended; solidweb.org also works). Inrupt PodSpaces is not supported.
- Open source, MIT license.

## Links
- [App](SITE)
- [Create a Pod guide](SITEstart)
- [Source and README](https://github.com/TeebooTed/Podsta)
- [Architecture](https://github.com/TeebooTed/Podsta/blob/main/docs/ARCHITECTURE.md)
```

### P2: repo metadata
- **Description (≤350 chars):** `Photo-and-text social app that stores everything in your Solid Pod. No Podsta server, no central directory, per-post audiences.`
- **Topics:** `solid` `solid-pod` `solid-project` `decentralized` `decentralized-social` `social-network` `linked-data` `web-access-control` `react` `vite` `privacy` `photo-sharing`
- **Homepage:** the live URL.
- **Social preview:** Settings → General → Social preview. Upload a 1280x640 PNG (the same art as og-image).
- **Release:** tag `v1.0.0` (package.json version) with notes from CHANGELOG.md. Catalogs and listings like to see a release.

### P2: README additions (at the top, under the pitch)
```markdown
**Try it:** <LIVE URL> · **New to Solid?** <LIVE URL>/start

![Podsta home feed](docs/screenshots/home-desktop.png)
```
Also: add a short GIF of posting a photo (sign in → post → feed), and a "Contributing" section that links CONTRIBUTING.md (it's currently linked only in the dev section).

### P3
- Add `<meta name="theme-color">` (already present) and `color-scheme`.
- Self-host fonts or keep the Google Fonts preconnect. Run PSI after deploying (the key is in the env).
- Submit the site to Google Search Console and Bing after launch.
- Once there's a custom domain, add a `CNAME` and redirect the old URL.

## Listing plan (all links checked 21 Oct 2026, HTTP 200 unless noted)
1. **solidproject.org/apps** (https://solidproject.org/apps). Repo https://github.com/solid/solidproject.org (Jekyll; the app list is generated from `apps.html` and `rdfa/ttl/apps.ttl`). Steps: wait until the live URL works, then fork, add a Podsta entry to `apps.html` following the existing entries' markup (name, description, license, "Source code on GitHub (TeebooTed/Podsta)"), and open a PR. Alternatively, open an issue with the details. The README rule is "submit a pull request to this repository or open an issue."
2. **Solid Forum, Applications category:** https://forum.solidproject.org/c/applications/41. Post an announcement with the live link and screenshots.
3. **awesome-solid:** https://github.com/kustomzone/awesome-solid (last push Feb 2026, no CONTRIBUTING file). Open a PR adding a line under "_Apps_" in the existing format:
   `- [Podsta](https://github.com/TeebooTed/Podsta) | [![github](/img/github.svg) ](https://github.com/TeebooTed/Podsta) - Photo-and-text app that stores everything in your Solid Pod. | [Live](<LIVE URL>)`
   `github.com/solid/awesome-solid` is a 404. `github.com/solid/solid-apps` loads but returned no API metadata, so don't rely on it.
4. **Show HN** (rules: https://news.ycombinator.com/showhn.html). It must be something people can try, with no signup walls. Podsta needs a Solid Pod, so say up front that sign-up happens at Solid Community and link `/start`. Readiness checklist: live URL works, deep links work, README has the demo link, author is present to answer comments.
5. **Product Hunt** (https://www.producthunt.com/launch). Needs a live URL, a 240x240 icon, a 1270x760 gallery (reuse the screenshots), a tagline of ≤60 chars, and a maker comment. Launch early Pacific time.

## Draft copy (based on README wording only)
**Show HN title:** `Show HN: Podsta – photo and text posts stored in your own Solid Pod`
**Show HN text:**
> Podsta is a photo-and-text app that stores everything in your Solid Pod. There is no Podsta server and no central directory; the browser talks to your Pod, and to the Pods of people you follow, with Web Access Control. New profiles start Hidden, and a post can't be more open than the profile. Comments and likes live in the commenter's own Pod. If you don't have a Pod, the /start guide walks you through Solid Community. MIT licensed: https://github.com/TeebooTed/Podsta

**Product Hunt tagline (≤60):** `Your posts. Your Pod. Your rules.`
**Product Hunt description:** `A photo-and-text app with no server of its own: everything lives in your Solid Pod, with per-post audiences (Only me, Contacts, Public), comments and likes stored in each person's Pod, and an invite/QR flow to find people by WebID.`

**Gate:** don't list or launch anywhere until P1 (the live URL) is done.
