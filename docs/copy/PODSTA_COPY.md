# Podsta product copy

Draft copy for Podsta, based on the `main` branch of github.com/TeebooTed/Podsta (commit 83b46b5, 10 October 2026). Everything below describes features in that code, unless it is marked **[proposed]**. See "Notes for review" at the end.

Glossary used in this copy (keep it out of the UI where possible):
- **Pod**: your own storage space on the web. Your photos and posts live there.
- **Pod host**: the company or group that runs the server your pod sits on (Solid Community is the one Podsta recommends).
- **Your address** (technically your WebID): the web link that identifies you. Podsta shows it as a short name like @ada.

---

## 1. Landing page

### Headline options

1. Your photos. Your pod. Your rules.
2. Share photos from a place you own.
3. A photo app that doesn't keep your photos.
4. Post to your friends. Keep the keys.
5. Your photos live with you, and Podsta just shows them.

### Subhead

Podsta is a photo and note sharing app. Everything you post is saved in your own pod, a personal storage space on the web. Podsta has no server of its own and keeps no copy. You decide who sees each post.

### Benefit blocks

**Your photos stay yours**
Every photo, caption and comment you write is saved in your pod. Podsta reads it from there and doesn't keep a copy anywhere else.

**Private until you say so**
New profiles start hidden and new posts start as Only me. When you're ready, share a post with the people you approve, or with everyone.

**Friends, the old-fashioned way**
Follow people by their address or an invite link, or scan their QR code. Your feed shows posts from people you follow, newest first, with no strangers pushed in.

### What's a pod?

A pod is your own little storage space on the web, a bit like a personal locker. You get one from a pod host, the same way you get an email account from an email provider. When you post on Podsta, your photos and notes go into your locker. Podsta is the window you look through. You choose who gets a key: just you, the people you approve, or everyone. Because your things live in your pod, other apps that work with pods can be allowed in too. And if you stop using Podsta one day, your posts are still sitting in your pod, where you left them.

### FAQ

**What happens to my photos if Podsta disappears?**
They stay in your pod. Podsta never had its own copy, so there is nothing to lose on our side. Your photos are ordinary image files in a "podsta" folder in your pod, and your pod host keeps them for as long as your account lasts. You would need another pod-friendly tool, or your pod host's own file browser, to look at them without Podsta.

**Who can see my photos?**
You choose for each post. Only me means only you. Contacts means people you have approved, and following someone doesn't approve them. Public means anyone with the link. Your profile setting sets the limit: a hidden profile can only make Only me posts. One heads-up: Podsta uploads public photos exactly as you send them, so any location your camera saved stays in the file.

**Is Podsta free?**
Podsta has no accounts, no subscriptions and no paid features. It's also open source under the MIT license. Your pod comes from a pod host, and each host sets its own terms, so check theirs when you sign up.

**How do I get a pod?**
Tap "I don't have a Pod." Podsta walks you over to Solid Community, where you make an account with an email and a password and pick a short name. Then Solid Community sends you back, signed in. Podsta never sees your password.

**Can I use a pod I already have?**
Yes, if your pod host uses the same sharing system Solid Community does (it's called Web Access Control). Solid Community and SolidWeb both work. Inrupt PodSpaces uses a different system, so sharing doesn't work there yet.

**Can I move to a different pod host later?**
Your posts are plain files, so they can be copied from one pod to another. Podsta doesn't have a move button yet, though. Your address would also change with the new host, so friends would need your new invite link to keep following you.

**How do people find me?**
There's no central list of names. Share your invite link or your QR code, or send someone your address. Your short name, like @ada, comes from your address. It isn't a username anyone else can claim.

**How do I know when someone comments or likes my post?**
Podsta checks for news about once a minute while the tab is open, and lights the bell when something new turns up: posts from people you follow, comments on your posts, and contact requests.

---

## 2. First-run and onboarding

### Welcome screen (signed out)

- Title: **Podsta**
- Tagline: your posts. your pod. your rules.
- Card heading: **Sign in with your pod**
- Body: Podsta doesn't have its own accounts. Your photos and posts live in a pod you control. New here? We'll help you get one in a couple of minutes.
- Primary button: **Sign in** (helper line: solidcommunity.net · I already have a pod)
- Secondary button: **I don't have a pod** (helper line: Make one on Solid Community, then come back)
- Link: **I use a different pod host**

### Choose a pod host (expanded from "I use a different pod host")

- Intro: Podsta works with pod hosts that share posts the same way Solid Community does.
- Option: **SolidWeb**. Helper: solidweb.org. Works with Podsta.
- Option: **Inrupt PodSpaces**. Helper: Sharing doesn't work here yet. You can sign in, but your posts can't reach anyone else.
- Field label: Your pod host's web address
- Field placeholder: https://your-pod-host.example
- Field helper: Sharing works only if this host uses Web Access Control. Your host can tell you.
- Button: **Sign in with this host**
- Toggle when open: **Hide other hosts**

### Get a pod (the /start guide)

- Heading: **Let's get you a pod**
- Body: A pod is your own place on the web for posts. We recommend Solid Community. It's quick and it works well with Podsta.
- Step 1: **You'll hop over to Solid Community.** The next page belongs to them. Choose Sign up if you're new.
- Step 2: **Make an account with your email and a password.** Solid Community keeps your login. Podsta never sees your password.
- Step 3: **Pick a short name.** It becomes your address, and in Podsta you'll show up as @yourname. You can change your display name any time. The short name stays.
- Step 4: **Come back here.** Solid Community sends you back signed in. If you closed the window early, come back and tap Sign in.
- Primary button: **Continue to Solid Community**
- Busy state: Opening Solid Community…
- Link: **I already have a pod**

### Permission / consent step

This happens in two places.

**a) Before we send you to your pod host** (short note under the sign-in button) **[proposed]**
- Text: Your pod host will ask if Podsta may use your pod. Say yes so Podsta can save your posts there. You can take that permission back from your pod host at any time.

**b) Back in Podsta: "We found you"** (the modal after a new sign-up)
- Title: **We found you**
- Body: Solid Community sent you back signed in. This is the address Podsta will use for you.
- Shows: @yourname and the full address
- Button: **Continue**

**c) Tour step: who can find you?** (the visibility step of the first-run tour)
- Title: **Who can find you?**
- Body: You start hidden. Change this whenever you like.
- Option **Hidden**: Nobody's told you're here. Only people who already have your address or a direct link can reach you. Your posts stay Only me.
- Option **Contacts only**: People you approve can see the posts you share with them. Following you doesn't count as approval. Heads-up: the list of who you've approved can be seen by others, because that's how your pod checks who's allowed in.
- Option **Public**: Anyone with your address can see your profile and your public posts. People who follow your friends may spot you too.
- Buttons: **Next** · **Back** · **Skip**
- Saving state: Saving…

### The rest of the tour (5 steps, all skippable)

Step 1
- Title: **Your posts live in your pod**
- Body: Your pod is your own storage space on the web. Podsta doesn't keep a copy. If you ever leave, your posts stay right where they are.
- Buttons: **Next** · **Skip**

Step 2
- Title: **What should people call you?**
- Body: We'll save this name in your pod and show it next to your posts. You can change it on your profile.
- Field label: Display name. Placeholder: Your name
- Buttons: **Next** · **Back** · **Skip**

Step 3
- Title: **This is how friends follow you**
- Body: Send your invite link or show your QR code. People will see you as @yourname. The link carries your full address, so it always points to you.
- Buttons: **Copy invite link** · **Copy my address** · **Next** · **Back** · **Skip**
- Toasts: Invite link copied · Address copied · Couldn't copy that. Try selecting it instead.

Step 4: Who can find you? (see 2c above)

### First-upload prompt (tour step 5)

- Title: **Ready for your first post?**
- Body: One photo or a short note is plenty. Add up to ten photos, crop or rotate them, and pick who sees it. New posts start as Only me.
- Buttons: **Make a post** · **Not now**

### Done

- Toast after the first post saves: **Posted to your pod.**
- If shared: **Shared with your contacts.** / **Shared with everyone.**
- If sharing didn't finish: **Saved in your pod, but sharing didn't finish. It's still Only me for now. Try sharing again from the post.**
- Toast after "Not now" or Skip **[proposed]**: **You're all set. Tap New post whenever you're ready.**

---

## 3. Empty states

**Profile grid, no posts yet**
- Title: **Nothing here yet**
- Body: Your photos and notes will fill this grid. New posts stay private until you share them.
- Button: **Make your first post**

**Home feed, not following anyone yet**
- Title: **Your feed starts with one person**
- Body: Send your invite link to someone you'd like to hear from, or follow someone whose address you already have.
- Buttons: **Copy my invite link** · **Follow someone** · **Write a post instead**

**Home feed, following people but nobody has posted**
- Title: **All quiet for now**
- Body: The people you follow haven't shared anything with you yet. When they do, it'll show up here.
- Button: **Follow someone else**

**Discover, nobody to suggest**
- Title: **No one to suggest yet**
- Body: Podsta has no big phone book. Suggestions come from people your friends follow, once they've made their lists public. Got someone's address or @name? Paste it above.

**Discover, "People you may know" while loading**
- Text: Looking through your friends' lists…

**Someone's profile, no public posts**
- Title: **No public posts yet**
- Body: When they share a post with everyone, it'll appear here.

**Notifications, nothing new**
- Title: **Nothing new**
- Body: New posts from people you follow, comments on your posts and contact requests will show up here.
- Button: **Check now**

**Comments, none yet**
- Text: No comments yet. Say something nice.

**Likes, none yet** **[proposed]**
- Text: No likes yet.

**Invite link with nobody in it**
- Title: **This invite is missing someone**
- Body: The link didn't say who it's for. Ask them to send it again, or paste their address on Discover.
- Button: **Go to Discover**

**Post link that doesn't name a post**
- Title: **This link is missing its post**
- Body: Something got cut off along the way. Ask for the link again.
- Button: **Back home**

**No search results** (Discover has no search box; this covers the follow box when an address or @name leads nowhere)
- Title: **We couldn't find that person**
- Body: Check the spelling. A short name like @ada only works for Solid Community. For other hosts, try @ada@solidweb.org or paste their full address.
- Button: **Try again**

---

## 4. Error messages

Each message says what happened, then what to do.

**Login failed**
We couldn't sign you in. Your pod host didn't answer or said no. Check the address and try again, or pick Solid Community from the list.
- Button: **Try again**

**Signed out mid-way / session ended** **[proposed]**
You've been signed out. It happens now and then. Sign in again and you'll be right back where you were.
- Button: **Sign in**

**Pod unreachable (your own)**
Your pod isn't answering right now. Your posts are safe. Give it a minute and try again.
- Button: **Try again**

**Some friends' pods unreachable (feed)**
2 pods didn't answer in time, so a few posts may be missing. Everything else is here.
- Link: **Try again**
- Singular: 1 pod didn't answer in time, so a few posts may be missing.

**Pod busy**
Your pod is a bit busy. Give it a moment and try again.

**Permission denied (a post you can't see)**
- Title: **This post isn't shared with you**
- Body: It may be private, or their pod didn't answer. If you know them, ask them to add you as a contact.
- Button: **Open original**

**Permission denied (sharing didn't apply)**
We saved your post, but couldn't change who can see it. It's still Only me. Try sharing again in a moment.

**Visibility above your profile setting**
That's more open than your profile allows. Change who can find you on your profile first, then try again.

**Upload failed**
Some photos didn't make it to your pod. The ones that did are safe. Tap Retry and we'll only send the rest.
- Buttons: **Retry** · **Cancel**

**File too big**
That photo is too big. Each one can be up to 10 MB. Try a smaller copy, or crop it first.

**Wrong file type**
We can't use that file. Podsta takes JPEG, PNG, GIF and WebP photos.

**Too many photos**
That's the limit. One post holds up to ten photos.

**Caption or note too long**
That's a bit long. Captions fit 280 characters, notes fit 5,000, comments fit 500.

**Offline** **[proposed]**
You're offline. Nothing's lost. Podsta will try again once you're back online.

**Comment didn't reach the author**
Your comment is saved in your pod, but we couldn't let the author know yet. Others may not see it until they do.

**Follow failed**
We couldn't follow that person. Check their address and try again.

**Profile or name didn't save**
We couldn't save that to your pod. Try again in a moment.

**Generic error**
Something went wrong on our end. Your posts are safe in your pod. Try again, and if it keeps happening, reload the page.
- Button: **Try again**

---

## 5. App-store-style description

Podsta is a photo and note sharing app where everything you post lives in your own pod, a personal storage space on the web that you control. Podsta has no server of its own and keeps no copy. Post up to ten photos at a time, crop and rotate them first, and add a caption. Every post starts private. Share it with the people you approve, or with everyone. Follow friends with an invite link or QR code, and see their posts in your feed. Comment, like and get a heads-up when something new happens. New to pods? Podsta helps you set one up on Solid Community in a few steps.

---

## 6. Open Data Institute Solid apps listing

Podsta is an open-source (MIT) photo and text sharing web app for Solid pods using Web Access Control. It stores in your pod: photos and text posts, captions, profile (name, bio, avatar), follow list, approved contacts, comments you write, likes, blocks, and contact requests. Each post is Only me, Contacts or Public.

---

## Notes for review

1. **Live site is down.** https://teebooted.github.io/Podsta returns 404. The GitHub Pages setup is on the unmerged branch `cursor/github-pages-bcc8`. I wrote from the code and README on `main`, not from the running app. (podsta.vercel.app serves a page titled "Podsta", but I couldn't confirm it's this build. Its meta description says "No algorithms. No surveillance." That's a claim I didn't repeat.)
2. **App-store description.** Podsta is a web app. It can't be installed: the README says so, there's no service worker, and the PWA work is still open. Use section 5 for a web directory, or wait for the PWA before using it in a real store.
3. **"Is it free?"** There's no pricing anywhere in the repo. I only said Podsta has no accounts or paid features and is MIT licensed. I made no claim about what pod hosts charge.
4. **Moving between pod hosts.** The app has no export or migration feature. The FAQ says so. Copying the `podsta/` folder by hand would also need the sharing files rewritten, and your address (WebID) changes, so followers lose you. Check that the answer is honest enough.
5. **"If Podsta disappears."** This is true for the data. But no other app reads Podsta's post format today, so you'd only see raw files. The FAQ hints at this without promising another viewer.
6. **Consent step.** Podsta has no permission screen of its own. Any "allow this app" screen comes from the pod host during sign-in. Copy 2a is **[proposed]** and assumes the host shows that screen and lets you take permission back. The visibility step (2c) is the in-app privacy choice.
7. **Proposed copy for things that don't exist yet:** offline detection (the code doesn't check for it), a session-expired message, a "No likes yet" state, a post-tour toast, and the follow-lookup "couldn't find that person" state. There's no search feature. Discover only has follow-by-address and suggestions.
8. **Renamed for plain words.** WebID → "address", Pod → "pod", "Copy WebID" → "Copy my address". Changing the UI strings means code edits in `onboarding.js`, `navigation.js`, `discoverability.js`, `provider.js`, `LoginPage.jsx` and others. The app's own copy uses "WebID" a lot.
9. **Upload retry wording.** "We'll only send the rest" matches the README ("retried without sending photos that already landed"). In the code, the composer's Post button turns into **Retry** after an error. I've also added a **Cancel** button there.
10. **Feed order and "no strangers pushed in".** Confirmed. The feed loads posts from people you follow only. `feed.js` sorts it newest first, which I confirmed.
11. **Notification timing.** The code checks about every 45 seconds, backs off up to 5 minutes after failures, and pauses in a hidden tab. The app says "about every minute", and so does the FAQ. Notices cover new posts, comments, and contact requests or approvals. Like notices get merged into counts, but likes aren't listed as a notification type. The FAQ question mentions likes and the answer doesn't promise them, so you may want to drop "or likes" from the question.
12. **Privacy caveats kept in.** Location data (EXIF) isn't removed from public photos, and the FAQ says so. The Contacts list is readable by others while Contacts is on, and the tour says so. Your address document is usually public even when you're hidden. That's left out of the landing copy, so consider adding it to the FAQ.
13. **Contacts vs. following.** Approving someone happens through contact requests. Following someone only fills your feed. The copy keeps these separate. Make sure designers don't merge them.
14. **@name rules.** A bare @ada is assumed to mean solidcommunity.net. Other hosts use @ada@solidweb.org, which matches the DiscoverPage hint text.
15. **Beta status.** The login screen calls this "this beta". The copy doesn't say beta anywhere. Add it if you want to set expectations.
