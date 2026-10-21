import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('the home feed and profile do not statically import the viewer, QR, or Instagram reader', () => {
  const home = source('src/pages/HomePage.jsx');
  const grid = source('src/components/PostGrid.jsx');
  const person = source('src/components/PublicPerson.jsx');
  const profile = source('src/pages/ProfilePage.jsx');
  const pack = source('src/components/StarterPack.jsx');
  for (const file of [home, grid, person]) {
    assert.equal(file.includes("from './Lightbox.jsx'") || file.includes("from '../components/Lightbox.jsx'"), false);
    assert.match(file, /LazyLightbox/);
  }
  assert.match(profile, /import\('\.\.\/components\/InviteQr\.jsx'\)/);
  assert.match(profile, /import\('\.\.\/components\/InstagramImport\.jsx'\)/);
  assert.equal(profile.includes("from '../components/InviteQr.jsx'"), false);
  assert.equal(profile.includes("from '../components/InstagramImport.jsx'"), false);
  assert.match(pack, /import\('\.\/InviteQr\.jsx'\)/);
  assert.equal(pack.includes("from './InviteQr.jsx'"), false);
});
