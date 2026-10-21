import { expect, test } from '@playwright/test';
import { createPod } from './pods.js';
import { SOLID_ISSUER } from './solidServer.js';

const APP = 'http://localhost:4173';
const PASSWORD = 'podsta-test-password-1';

test.describe.configure({ mode: 'serial' });

test('two people can post, follow, and hear about each other', async ({ browser }) => {
  test.setTimeout(300000);
  const stamp = Date.now().toString(36);
  const [alice, bob] = await Promise.all([
    createPod({
      email: `alice${stamp}@example.com`,
      password: PASSWORD,
      name: `alice${stamp}`,
    }),
    createPod({
      email: `bob${stamp}@example.com`,
      password: PASSWORD,
      name: `bob${stamp}`,
    }),
  ]);

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  let charlieContext;
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  alicePage.setDefaultTimeout(20000);
  bobPage.setDefaultTimeout(20000);

  try {
    await signIn(alicePage, alice);
    await signIn(bobPage, bob);

    await openProfile(alicePage);
    await alicePage.locator('#profile-name').fill('Alice');
    await alicePage.getByRole('button', { name: 'Save profile' }).click();
    await expect(alicePage.getByText('Profile saved')).toBeVisible();
    await alicePage.getByRole('radio', { name: /^Public/ }).check();
    await alicePage.getByRole('button', { name: 'Save discoverability' }).click();
    await expect(alicePage.getByText('Discoverability saved')).toBeVisible({ timeout: 60000 });

    await postNote(alicePage, {
      title: 'Only me picnic',
      body: 'This note stays with Alice.',
      audience: 'Only me',
    });
    await postNote(alicePage, {
      title: 'Contacts picnic',
      body: 'Approved people can read this.',
      audience: 'Contacts',
    });
    await postNote(alicePage, {
      title: 'Public picnic',
      body: 'Anyone with the link can read this.',
      audience: 'Public',
    });

    await alicePage.getByRole('link', { name: 'Home', exact: true }).click();
    await openProfile(alicePage);
    await expect(alicePage.getByRole('button', { name: /Private post: Only me picnic/ })).toBeVisible();
    await expect(alicePage.getByRole('button', { name: /Contacts post: Contacts picnic/ })).toBeVisible();
    await expect(alicePage.getByRole('button', { name: /Public post: Public picnic/ })).toBeVisible({
      timeout: 20000,
    });

    await bobPage.getByRole('link', { name: 'Discover', exact: true }).click();
    await bobPage.locator('#webid-input').fill(alice.webId);
    await bobPage.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(bobPage.getByText(/Now following/)).toBeVisible();

    await bobPage.getByRole('link', { name: 'Home', exact: true }).click();
    const publicCard = bobPage.locator('article').filter({ hasText: 'Public picnic' });
    await expect(publicCard).toBeVisible({ timeout: 30000 });
    await expect(bobPage.getByText('Contacts picnic')).toHaveCount(0);
    await expect(bobPage.getByText('Only me picnic')).toHaveCount(0);

    await publicCard.getByRole('link').first().click();
    await bobPage.getByRole('button', { name: 'Ask to be a contact' }).click();
    await expect(bobPage.getByText(/Contact request sent|Request saved on your pod/)).toBeVisible();

    // A request in the inbox shows up on its own. If the pod host refuses that
    // post, Alice still sees it by following Bob, which is how the app reads
    // requests from people she follows.
    await alicePage.getByRole('link', { name: 'Discover', exact: true }).click();
    await alicePage.locator('#webid-input').fill(bob.webId);
    await alicePage.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(alicePage.getByText(/Now following/)).toBeVisible();

    await alicePage.getByRole('link', { name: /^Notifications/ }).click();
    await alicePage.getByRole('button', { name: 'Check now' }).click();
    await expect(alicePage.getByText(/asked to be a contact/)).toBeVisible({ timeout: 30000 });
    await alicePage.getByRole('button', { name: 'Approve' }).click();
    // The row says "Approved" and the toast says "Approved. They have been notified."
    // A prefix match hits both while the toast is still up.
    await expect(alicePage.getByText('Approved', { exact: true })).toBeVisible();

    await bobPage.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(bobPage.getByText('Public picnic')).toBeVisible({ timeout: 30000 });
    await expect(bobPage.getByText('Contacts picnic')).toBeVisible({ timeout: 30000 });
    await expect(bobPage.getByText('Only me picnic')).toHaveCount(0);

    await publicCard.getByRole('button', { name: 'Like' }).click();
    await expect(publicCard.getByRole('button', { name: 'Like' })).toHaveAttribute('aria-pressed', 'true');
    await publicCard.getByRole('button', { name: 'Comments' }).click();
    const comments = bobPage.getByRole('dialog', { name: 'Comments' });
    await comments.locator('#comment-text').fill('See you at the picnic');
    await comments.getByRole('button', { name: 'Post comment' }).click();
    await expect(comments.getByText('See you at the picnic')).toBeVisible({ timeout: 30000 });
    await expect(comments.getByText('The author was notified.')).toBeVisible();
    await comments.getByRole('button', { name: 'Close comments' }).click();

    await bobPage.getByRole('link', { name: /^Notifications/ }).click();
    await bobPage.getByRole('button', { name: 'Check now' }).click();
    await expect(bobPage.getByText(/approved you as a contact|posted/)).toBeVisible({ timeout: 30000 });

    // A comment check just after another check can reuse a short cache and miss
    // the notice. Wait for that window, then look again.
    await alicePage.waitForTimeout(16000);
    await alicePage.getByRole('button', { name: 'Check now' }).click();
    await expect(alicePage.getByText(/commented on your post/)).toBeVisible({ timeout: 30000 });

    await openProfile(alicePage);
    await alicePage.getByRole('button', { name: /Public post: Public picnic/ }).click();
    await expect(alicePage.getByRole('dialog').getByText(/1 like/)).toBeVisible({ timeout: 30000 });
    await alicePage.keyboard.press('Escape');
    await expect(alicePage.getByRole('dialog')).toBeHidden();

    const charlie = await createPod({
      email: `charlie${stamp}@example.com`,
      password: PASSWORD,
      name: `charlie${stamp}`,
    });
    charlieContext = await browser.newContext();
    const charliePage = await charlieContext.newPage();
    charliePage.setDefaultTimeout(20000);
    await signIn(charliePage, charlie, { followWebId: alice.webId });
    await expect(charliePage.getByText(/You're following/)).toBeVisible({ timeout: 45000 });
    await expect(charliePage.getByText(/public posts are on Home/)).toBeVisible();
    await expect(charliePage.getByText('Public picnic')).toBeVisible({ timeout: 30000 });
    await alicePage.getByRole('link', { name: /^Notifications/ }).click();
    await alicePage.getByRole('button', { name: 'Check now' }).click();
    await expect(alicePage.getByText(new RegExp(`@${charlie.name}`))).toBeVisible({ timeout: 30000 });
    await charliePage.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(charliePage.getByText(/Stopped following them/)).toBeVisible();
    await expect(charliePage.getByText('Public picnic')).toHaveCount(0);
  } finally {
    await aliceContext.close();
    await bobContext.close();
    await charlieContext?.close();
  }
});

async function signIn(page, account, { followWebId = '' } = {}) {
  await page.goto(`${APP}/`);
<<<<<<< HEAD
  if (followWebId) {
    await page.evaluate((id) => sessionStorage.setItem('podsta.follow', id), followWebId);
  }
  await page.getByRole('button', { name: 'I use a different pod host' }).click();
=======
  await page.getByRole('button', { name: 'Advanced' }).click();
>>>>>>> 87e080a (Make Create my Pod the one-tap default.)
  await page.locator('#custom-issuer').fill(SOLID_ISSUER);
  await page.getByRole('button', { name: 'Sign in with this host' }).click();
  await page.waitForURL(/localhost:3456/, { timeout: 30000 });
  await completePodHost(page, account);
  await expect(page).toHaveURL(/localhost:4173/, { timeout: 30000 });
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 45000 });
  await expect(page.getByRole('button', { name: 'New post' })).toBeVisible();
  await dismissWhatsNew(page);
}

/** The first-run tour marks the person as returning, so the What's new sheet can open on top. */
async function dismissWhatsNew(page) {
  const sheet = page.getByRole('dialog', { name: /new in Podsta/ });
  try {
    await sheet.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return;
  }
  await sheet.getByRole('button', { name: 'Got it' }).click();
  await expect(sheet).toBeHidden();
}

async function completePodHost(page, account) {
  for (let step = 0; step < 6; step += 1) {
    if (/localhost:4173/.test(page.url())) return;
    const email = page.locator('#email');
    const authorize = page.locator('#authorize');
    if (await email.isVisible().catch(() => false)) {
      await email.fill(account.email);
      await page.locator('#password').fill(account.password);
      const login = page.getByRole('button', { name: 'Log in', exact: true });
      await expect(login).toBeEnabled();
      // The host page finishes login with fetch, then moves on. A normal click
      // waits for a document navigation that never comes and holds the test.
      await login.click({ noWaitAfter: true });
      await page.waitForURL((url) => !url.pathname.includes('/login/password'), { timeout: 20000 });
      continue;
    }
    if (await authorize.isVisible().catch(() => false)) {
      await expect(authorize).toBeEnabled({ timeout: 20000 });
      await authorize.click({ noWaitAfter: true });
      await page.waitForURL(/localhost:4173/, { timeout: 30000 });
      return;
    }
    await page.waitForTimeout(500);
  }
  const hostError = page.locator('#error');
  const detail = (await hostError.isVisible().catch(() => false)) ? await hostError.innerText() : '';
  throw new Error(`Sign-in did not return to Podsta. Stuck on ${page.url()}. ${detail}`);
}

async function openProfile(page) {
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Discoverability' })).toBeVisible();
}

async function postNote(page, { title, body, audience }) {
  await page.getByRole('button', { name: 'New post' }).click();
  const dialog = page.getByRole('dialog', { name: 'New post' });
  await dialog.getByRole('button', { name: 'Text', exact: true }).click();
  await dialog.locator('#composer-title').fill(title);
  await dialog.locator('#composer-body').fill(body);
  await dialog.getByRole('radio', { name: new RegExp(`^${audience}\\b`) }).check();
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  const toast =
    audience === 'Public'
      ? 'Shared with everyone.'
      : audience === 'Contacts'
        ? 'Shared with your contacts.'
        : 'Posted to your pod.';
  const failed = page.getByText("sharing didn't finish");
  await expect(page.getByText(toast).or(failed)).toBeVisible({ timeout: 45000 });
  if (await failed.isVisible()) throw new Error(await failed.innerText());
  await expect(dialog).toBeHidden();
}
