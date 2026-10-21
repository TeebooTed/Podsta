# Podsta: What Makes Photo Apps Stick, and How Decentralized Apps Onboard

*Research brief, Oct 21, 2026. Every source below was opened on that date.*

**Podsta today.** The repo README describes Podsta as "Instagram for Solid Pods": there is no Podsta server, a following-only Home feed, posts of up to ten photos, per-post audiences, and comments and likes stored in each user's own Pod. Discovery works through WebID, invite links and QR codes, and the `@name` is derived from the WebID rather than registered. New profiles start Hidden. A `/start` guide sends people without a Pod to Solid Community. Inrupt PodSpaces is not supported (it uses ACP, and Podsta writes WAC). The app is not yet installable as a PWA, and it polls for notifications ([README](https://github.com/TeebooTed/Podsta)). **Note:** on Oct 21, 2026 the given URL, https://teebooted.github.io/Podsta, returned a 404, and the repo has GitHub Pages turned off. The live app could not be reviewed, so this brief is based on the README.

## 1. Why people love and keep using photo apps

**Instant craft, minimal steps (early Instagram).**
- Systrom named three problems the app solved: slow uploads, sharing to several networks at once, and bad phone cameras. Filters fixed the cameras by putting "the power of something complex in a single tap" ([Vanity Fair](https://www.vanityfair.com/news/2015/10/instagram-5-years-kevin-systrom)).
- The team made posting take "as few actions as possible": a photo could go up in three clicks, with no forced tagging ([TechCrunch](https://techcrunch.com/2012/04/09/instagram-story-facebook-acquisition/)).
- The app passed 1 million registered users about two months after launch. The NYT credited its "balance of simplicity, speed and artistic filters" and easy cross-posting ([NYT Bits](https://archive.nytimes.com/bits.blogs.nytimes.com/2010/12/21/instagram-quickly-passes-1-million-users/)).

**Low-pressure social plus pro tools (VSCO).**
- VSCO chose in 2013 not to show likes, comments or follower counts publicly, so that "all validation be more private."
- Its revenue comes from subscriptions (presets and editing tools), not ads. It also runs prompt-based "Challenges."
- The CEO said it had passed 2 million paid subscribers ([NY Mag](https://nymag.com/intelligencer/2019/09/vsco-ceo-joel-flory-on-the-vsco-girl-meme.html)).

**Photo-first, ad-free, no algorithm (Glass).**
- Glass is funded by memberships and has no advertising, behavioral profiling or "algorithmic pressure."
- Viewing is free; posting requires a paid plan.
- Each member has an invite link: the new member gets a discount and automatically follows the person who invited them ([Glass Help](https://glass.photo/help/membership-and-billing)).
- At launch it had full-screen photos, no likes, and visible EXIF data (camera, ISO, aperture), which TechCrunch called "candy for the photography nerds" ([TechCrunch](https://techcrunch.com/2021/09/03/instagram-may-not-be-a-photo-sharing-app-anymore-but-glass-is/)).

**Daily ritual among real friends (BeReal), and its limits.**
- Once a day, at a random time, BeReal gives users two minutes to post a front-plus-back camera photo. Late posts are flagged to friends.
- You must post before you can see your friends' posts ([ACM CHI 2024 study](https://dl.acm.org/doi/fullHtml/10.1145/3613904.3642690), read via web fetch because curl returned a 403).
- Daily users fell 61%, from about 15M (Oct 2022) to under 6M (Mar 2023), per Apptopia. Users described the ritual as hollow once only a few friends were left posting ([Dazed](https://www.dazeddigital.com/life-culture/article/61166/1/why-did-bereal-fail-social-media-instagram-authenticity)).
- **Lesson:** a prompt only drives retention if the person's friend graph stays active.

**Portability (Pixelfed).** Pixelfed's Instagram import brings over photos, captions and hashtags from Instagram's JSON export. Limits and permissions vary by instance ([Pixelfed Help Center](https://pixelfed.com/site/kb/import)).

**Common thread:** fast posting, a look that makes ordinary photos better, a calm feed of people you chose, and a reason to come back that depends on friends actually being there.

## 2. Onboarding in decentralized and Solid apps

**Server choice is the first wall.**
- Mastodon said that picking a provider "can be confusing." In May 2023 it added a default sign-up on a server it runs, with advanced selection still available. Its reasoning: "If we only attract people who already care about decentralization, our ability to make decentralization mainstream becomes that much harder" ([Mastodon blog](https://blog.joinmastodon.org/2023/05/a-new-onboarding-experience-on-mastodon/)).
- The trade-off was raised in a GitHub issue: defaulting to one server concentrates users there. A UX commenter suggested framing the choice as "what do you want your username to be?" rather than as picking a "server" ([mastodon-ios #1023](https://github.com/mastodon/mastodon-ios/issues/1023)).

**Social bootstrapping wins (Bluesky).**
- Starter packs, launched June 26, 2024, are shareable lists of up to 150 accounts and 3 feeds, with a link and a QR code. Creators are notified when someone joins through their pack ([Bluesky blog](https://www.bsky.social/about/blog/06-26-2024-starter-packs)).
- A study of 25M users and 335K packs found the packs were a major driver of follows, though they tend to reinforce communities that already exist ([ICWSM paper](https://ojs.aaai.org/index.php/ICWSM/article/view/35810)).

**Solid's specific friction.**
- In interviews with Solid app builders, "confusion about use of terminology" ranked as the third biggest struggle (WebID, data vault, "login vs connect").
- Builders also worried that users won't remember their WebIDs and will keep creating new ones. Some were looking at linking email to the WebID ([SolidLab Flanders UX interviews](https://solidlab.be/wp-content/uploads/2022/10/SolidLab_Flanders_UX_interview_results.pdf)).
- Login screens differ from app to app: some ask for a WebID, some for a Pod URL, some for an issuer ([Solid forum](https://forum.solidproject.org/t/has-any-work-been-done-to-standardise-ux-patterns-for-logging-into-solid-applications/5251)).
- A Feb 2025 issue on solidcommunity.net, titled "Signing up is very confusing," reports a dead end: an account was created inside an app's login flow, but no WebID was linked to it ([solidcommunity.net #76](https://github.com/solid/solidcommunity.net/issues/76)).

**Providers split by access model.**
- PodSpaces sign-up is a familiar username, email and password form, and gives a WebID at `id.inrupt.com/{username}` ([Inrupt docs](https://docs.inrupt.com/podspaces/podspaces/getting-started)).
- Solid's own "Get a Pod" page lists several providers, which is a choice step new users face before they can start ([Solid Project](https://solidproject.org/get_a_pod)).
- Podsta's WAC-only support means PodSpaces users are turned away.

**Summary of what works and what doesn't:**
- **Works:** defaults, invite links that come with a follow graph, and imports.
- **Doesn't:** jargon, URL-shaped identities, dead ends inside the sign-in flow, and choosing a provider before the user has seen any value.

## 3. Top 10 ideas for Podsta, ranked by impact

1. **Turn on a working public URL first.** The listed Pages site returns a 404, and nobody can onboard to an app they can't load.
2. **One-tap "Create my Pod" default, with advanced choice hidden.** This follows Mastodon's default-server lesson: show value first, and offer a choice of host later.
3. **Invite link = auto-follow + contact request.** Glass and Bluesky both connect the newcomer to the inviter from the start, so the first feed isn't empty.
4. **Starter packs of WebIDs (QR + link).** A pack follows many people with one click, which bootstraps the friend graph that retention depends on.
5. **Instagram import from the JSON export.** Pixelfed shows that bringing history over lowers the cost of switching. A Pod is a natural place to keep that archive.
6. **Signature one-tap filters and simple edits.** Filters were the main product insight at early Instagram and VSCO, and they make phone photos look good enough to share.
7. **Hide jargon: say "your account," and handle sign-in by email or handle.** Solid builders rank terminology confusion as a top struggle, and WebIDs are hard to remember.
8. **Calm metrics: likes private by default, no ranking.** VSCO and Glass position themselves around low pressure. Podsta's Pod-held likes suit this already.
9. **Installable PWA with push notifications.** Habit loops need reliable notifications on the home screen. Today the app polls and has no service worker.
10. **Optional weekly prompt or challenge, shown only when friends are active.** This takes the ritual idea from VSCO and BeReal while avoiding BeReal's notification fatigue among a thinning friend group. ACP/PodSpaces support is a later follow-up.

## Sources
- https://github.com/TeebooTed/Podsta (README)
- https://www.vanityfair.com/news/2015/10/instagram-5-years-kevin-systrom
- https://techcrunch.com/2012/04/09/instagram-story-facebook-acquisition/
- https://archive.nytimes.com/bits.blogs.nytimes.com/2010/12/21/instagram-quickly-passes-1-million-users/
- https://nymag.com/intelligencer/2019/09/vsco-ceo-joel-flory-on-the-vsco-girl-meme.html
- https://glass.photo/help/membership-and-billing
- https://techcrunch.com/2021/09/03/instagram-may-not-be-a-photo-sharing-app-anymore-but-glass-is/
- https://dl.acm.org/doi/fullHtml/10.1145/3613904.3642690 (curl returned 403; read via web fetch)
- https://www.dazeddigital.com/life-culture/article/61166/1/why-did-bereal-fail-social-media-instagram-authenticity
- https://pixelfed.com/site/kb/import
- https://blog.joinmastodon.org/2023/05/a-new-onboarding-experience-on-mastodon/
- https://github.com/mastodon/mastodon-ios/issues/1023
- https://www.bsky.social/about/blog/06-26-2024-starter-packs
- https://ojs.aaai.org/index.php/ICWSM/article/view/35810
- https://solidlab.be/wp-content/uploads/2022/10/SolidLab_Flanders_UX_interview_results.pdf
- https://forum.solidproject.org/t/has-any-work-been-done-to-standardise-ux-patterns-for-logging-into-solid-applications/5251
- https://github.com/solid/solidcommunity.net/issues/76
- https://docs.inrupt.com/podspaces/podspaces/getting-started
- https://solidproject.org/get_a_pod
