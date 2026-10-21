import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionFromPath } from '../src/lib/navigation.js';
import {
  MAX_PACK_MEMBERS,
  consumePack,
  packMembers,
  packPagePath,
  parsePack,
  rememberPack,
  serializePack,
} from '../src/lib/starterPack.js';

const ADA = 'https://ada.solidcommunity.net/profile/card#me';
const BOB = 'https://bob.solidcommunity.net/profile/card#me';
const CARA = 'https://cara.solidweb.org/profile/card#me';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('a pack keeps chosen https WebIDs and drops the author, duplicates, and scripts', () => {
  const members = packMembers(
    [BOB, BOB, ADA, 'javascript:alert(1)', 'http://bob.example/profile/card#me', CARA],
    ADA,
  );
  assert.deepEqual(members, [BOB, CARA]);
  const many = packMembers(
    Array.from({ length: 60 }, (_, index) => `https://p${index}.example/profile/card#me`),
    ADA,
  );
  assert.equal(many.length, MAX_PACK_MEMBERS);
});

test('a pack round-trips and the link cannot point off https', () => {
  const turtle = serializePack({
    name: 'Harbour "friends"',
    authorWebId: ADA,
    created: '2026-04-08T00:00:00.000Z',
    members: [BOB, ADA, CARA],
  });
  const parsed = parsePack(turtle);
  assert.equal(parsed.name, 'Harbour "friends"');
  assert.equal(parsed.authorWebId, ADA);
  assert.deepEqual(parsed.members, [BOB, CARA]);
  assert.equal(parsePack('not a pack'), null);
  assert.throws(() => serializePack({ name: 'x', authorWebId: 'javascript:alert(1)', members: [BOB] }));
  const file = 'https://ada.solidcommunity.net/podsta/packs/abc.ttl';
  assert.equal(packPagePath(file), `/pack?url=${encodeURIComponent(file)}`);
  assert.equal(packPagePath('javascript:alert(1)'), '');
  assert.equal(sectionFromPath('/pack'), 'pack');
});

test('a pack follow list survives one sign-in redirect', () => {
  const storage = memoryStorage();
  rememberPack(storage, [BOB, ADA, 'not a person']);
  assert.deepEqual(consumePack(storage), [BOB, ADA]);
  assert.deepEqual(consumePack(storage), []);
});
