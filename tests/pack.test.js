import test from 'node:test';
import assert from 'node:assert/strict';
import { PATHS, sectionFromPath, DESKTOP_NAV, PHONE_NAV } from '../src/lib/navigation.js';
import {
  MAX_PACK_PEOPLE,
  consumePackFollow,
  loadOwnPack,
  packAppUrl,
  packFollowResult,
  packPath,
  packResourceUrl,
  parsePack,
  peopleToFollow,
  rememberPackFollow,
  serializePack,
  uniqueWebIds,
  urlFromPack,
} from '../src/lib/pack.js';

const ADA = 'https://ada.example/profile/card#me';
const BOB = 'https://bob.example/profile/card#me';
const CAM = 'https://cam.example/profile/card#me';
const POD = 'https://ada.example/';

test('a starter pack round-trips addresses and drops anything that is not one', () => {
  const turtle = serializePack([BOB, `  ${BOB}  `, CAM, 'javascript:alert(1)', 'not a url']);
  assert.match(turtle, /podsta:Pack|vocab#Pack/);
  assert.equal(turtle.includes('foaf:name'), false);
  assert.equal(turtle.includes('schema:image'), false);
  assert.deepEqual(parsePack(turtle), [BOB, CAM]);
  assert.deepEqual(parsePack('just some text'), []);
  assert.deepEqual(parsePack(''), []);
});

test('a pack stops at 50 addresses and keeps the first of each', () => {
  const many = Array.from({ length: 60 }, (_, index) => `https://p${index}.example/profile/card#me`);
  const kept = uniqueWebIds([many[0], many[0], ...many]);
  assert.equal(kept.length, MAX_PACK_PEOPLE);
  assert.equal(kept[0], many[0]);
  assert.equal(parsePack(serializePack(many)).length, MAX_PACK_PEOPLE);
});

test('follow skips you and people you already follow', () => {
  const following = [{ webId: BOB }];
  assert.deepEqual(peopleToFollow([ADA, BOB, CAM, BOB], { selfWebId: ADA, following }), [CAM]);
  assert.equal(packFollowResult(0, 0), "You're already following everyone in this pack.");
  assert.match(packFollowResult(1, 1), /1 person/);
  assert.match(packFollowResult(1, 1), /private profile stays private/);
  assert.match(packFollowResult(2, 1), /1 of 2/);
});

test('a pack link round-trips the file address and cannot leave this app', () => {
  const file = packResourceUrl(POD);
  assert.equal(file, `${POD}podsta/packs/starter.ttl`);
  const path = packPath(file);
  assert.equal(path.startsWith('/pack?url='), true);
  assert.equal(urlFromPack(path.slice(path.indexOf('?'))), file);
  assert.equal(packAppUrl('https://teebooted.github.io/Podsta/', file).startsWith('https://teebooted.github.io/Podsta/pack?url='), true);
  assert.equal(urlFromPack('?url=javascript:alert(1)'), '');
  assert.equal(PATHS.pack, '/pack');
  assert.equal(sectionFromPath('/pack'), 'pack');
  assert.equal(DESKTOP_NAV.some((item) => item.to === PATHS.pack), false);
  assert.equal(PHONE_NAV.some((item) => item.to === PATHS.pack), false);
});

test('a follow from a pack survives one redirect and is then forgotten', () => {
  const storage = new Map();
  const memory = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  rememberPackFollow(memory, [BOB, ADA, 'javascript:alert(1)']);
  assert.deepEqual(consumePackFollow(memory), [BOB, ADA]);
  assert.deepEqual(consumePackFollow(memory), []);
});

test('a missing pack is empty and a refused pack is not treated as empty', async () => {
  const missing = async () => new Response('', { status: 404 });
  assert.deepEqual(await loadOwnPack({ podUrl: POD, fetchFn: missing }), []);
  const denied = async () => new Response('no', { status: 403 });
  await assert.rejects(() => loadOwnPack({ podUrl: POD, fetchFn: denied }), /Could not read your starter pack/);
});
