import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { openZip } from '../src/lib/zipArchive.js';
import {
  decodeInstagramText,
  extractInstagramPosts,
  instagramSourceKey,
  openFileList,
  scanInstagramExport,
} from '../src/lib/instagramExport.js';
import { createMemoryLedger, ledgerKey } from '../src/lib/importLedger.js';
import { markAlreadyImported, runInstagramImport } from '../src/lib/instagramImport.js';

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value) {
  return Uint8Array.from([value & 255, (value >> 8) & 255]);
}

function u32(value) {
  return Uint8Array.from([value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255]);
}

function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const raw = typeof file.data === 'string' ? new TextEncoder().encode(file.data) : file.data;
    const method = file.method === 8 ? 8 : 0;
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x800),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(raw.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x800),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(raw.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const directory = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(directory.length),
    u32(offset),
    u16(0),
  ]);
  return new File([concat([...locals, directory, end])], 'instagram.zip', { type: 'application/zip' });
}

function memoryFs(records) {
  const map = new Map(
    Object.entries(records).map(([path, data]) => [
      path,
      typeof data === 'string' ? new TextEncoder().encode(data) : data,
    ]),
  );
  return {
    async list() {
      return [...map.keys()].map((path) => ({ path, size: map.get(path).length }));
    },
    async read(path) {
      return map.get(path);
    },
  };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

test('instagram text keeps real unicode and repairs latin-1 utf-8', () => {
  assert.equal(decodeInstagramText('hello'), 'hello');
  assert.equal(decodeInstagramText('café'), 'café');
  assert.equal(decodeInstagramText('caf\u00c3\u00a9'), 'café');
  assert.equal(decodeInstagramText(String.fromCharCode(0xf0, 0x9f, 0x98, 0x82)), '😂');
});

test('a JSON export becomes posts with original dates, and videos and extras are left out', () => {
  const caption = `caf\u00c3\u00a9 ${'b'.repeat(300)}`;
  const images = Array.from({ length: 11 }, (_, index) => `media/posts/2020/p${index}.jpg`);
  const posts = extractInstagramPosts(
    [
      {
        creation_timestamp: 1600000000,
        title: caption,
        media: [
          ...images.map((uri) => ({ uri, creation_timestamp: 1600000000 })),
          { uri: 'media/posts/2020/clip.mp4', creation_timestamp: 1600000000 },
        ],
      },
      {
        creation_timestamp: 1600001000,
        title: '',
        media: [{ uri: 'media/reels/only.mp4' }],
      },
      {
        title: 'Just a note',
      },
    ],
    'your_instagram_activity/content/posts_1.json',
  );
  assert.equal(posts.length, 3);
  assert.equal(posts[0].images.length, 10);
  assert.equal(posts[1].images.length, 1);
  assert.equal(posts[1].part, 2);
  assert.equal(posts[0].key !== posts[1].key, true);
  assert.equal(posts[0].createdAt, '2020-09-13T12:26:40.000Z');
  assert.equal(posts[0].caption.length, 280);
  assert.equal(posts[0].shortened, true);
  assert.equal(posts[0].caption.startsWith('café'), true);
  assert.equal(posts[0].videos, 1);
  assert.equal(posts[2].images.length, 0);
  assert.equal(posts[2].caption, 'Just a note');
  assert.equal(
    instagramSourceKey(posts[0].createdAt, images),
    posts[0].key,
  );
});

test('an older media.json and an archived file are both posts', () => {
  const legacy = extractInstagramPosts(
    {
      photos: [{ caption: 'Pier', taken_at: '2019-05-01T12:00:00+0000', path: 'photos/201905/pier.jpg', location: 'hidden' }],
    },
    'media.json',
  );
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].caption, 'Pier');
  assert.equal(legacy[0].images[0], 'photos/201905/pier.jpg');
  assert.equal(legacy[0].createdAt, '2019-05-01T12:00:00.000Z');
  assert.equal(JSON.stringify(legacy[0]).includes('hidden'), false);

  const archived = extractInstagramPosts(
    [{ creation_timestamp: 1500000000, title: 'Old', media: [{ uri: 'media/posts/old.jpg' }] }],
    'content/archived_posts.json',
  );
  assert.equal(archived[0].archived, true);
});

test('a zip or a folder can be scanned without reading every photo first', async () => {
  const json = JSON.stringify([
    {
      creation_timestamp: 1600000000,
      title: 'Zip day',
      media: [{ uri: 'media/posts/2020/one.jpg', creation_timestamp: 1600000000 }],
    },
  ]);
  const zip = makeZip([
    { name: 'instagram-ada/your_instagram_activity/content/posts_1.json', data: json, method: 8 },
    { name: 'instagram-ada/your_instagram_activity/media/posts/2020/one.jpg', data: JPEG, method: 0 },
    { name: '../secret.txt', data: 'nope', method: 0 },
    { name: 'notes.html', data: '<p>skip</p>', method: 0 },
  ]);
  const opened = await openZip(zip);
  const listing = await opened.list();
  assert.equal(listing.some((entry) => entry.path.includes('..')), false);
  const posts = await scanInstagramExport(opened, { pause: async () => {}, yieldEvery: 1 });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].caption, 'Zip day');
  assert.equal(posts[0].importable, true);
  assert.equal(posts[0].images[0].path.endsWith('one.jpg'), true);
  const bytes = await opened.read(posts[0].images[0].path);
  assert.deepEqual(bytes, JPEG);

  const skipped = await openFileList([
    { name: 'nope.txt', webkitRelativePath: '../nope.txt' },
  ]).list();
  assert.equal(skipped.length, 0);
  const fromFolder = await scanInstagramExport({
    async list() {
      return [
        { path: 'export/content/posts_1.json', size: json.length },
        { path: 'export/media/posts/2020/one.jpg', size: JPEG.length },
      ];
    },
    async read(path) {
      if (path.endsWith('.json')) return new TextEncoder().encode(json);
      return JPEG;
    },
  });
  assert.equal(fromFolder[0].importable, true);
});

test('a long export yields while it is being read', async () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    creation_timestamp: 1600000000 + index,
    title: `Post ${index}`,
    media: [{ uri: `media/posts/p${index}.jpg` }],
  }));
  let pauses = 0;
  const posts = await scanInstagramExport(
    memoryFs({
      'content/posts_1.json': JSON.stringify(items),
      ...Object.fromEntries(items.map((item) => [item.media[0].uri, JPEG])),
    }),
    {
      yieldEvery: 10,
      pause: async () => {
        pauses += 1;
      },
    },
  );
  assert.equal(posts.length, 40);
  assert.ok(pauses >= 4);
});

test('import keeps prepared bytes, skips saved posts, and resumes after a failure', async () => {
  const records = {
    'content/posts_1.json': JSON.stringify([
      {
        creation_timestamp: 1600000000,
        title: 'Keep me',
        media: [
          { uri: 'media/one.jpg' },
          { uri: 'media/two.jpg' },
        ],
      },
      {
        creation_timestamp: 1600002000,
        title: 'Already there',
        media: [{ uri: 'media/old.jpg' }],
      },
    ]),
    'media/one.jpg': JPEG,
    'media/two.jpg': JPEG,
    'media/old.jpg': JPEG,
  };
  const fs = memoryFs(records);
  const found = await scanInstagramExport(fs, { pause: async () => {} });
  const webId = 'https://ada.example/profile/card#me';
  const known = new Set([found[1].key]);
  const ledger = createMemoryLedger();
  const marked = await markAlreadyImported(found, known, ledger, webId);
  assert.equal(marked[1].alreadyImported, true);

  let uploads = 0;
  const uploadPost = async ({ files, audience, alreadyUploaded, post }) => {
    uploads += 1;
    const sent = new Uint8Array(await files[0].arrayBuffer());
    assert.deepEqual([...sent], [7]);
    assert.notEqual(files[0].name, 'one.jpg');
    if (uploads === 1) {
      assert.equal(audience, 'private');
      const error = new Error('The Pod did not respond');
      error.uploaded = ['https://ada.example/podsta/photos/one.jpg'];
      throw error;
    }
    assert.equal(audience, 'public');
    assert.deepEqual(alreadyUploaded, ['https://ada.example/podsta/photos/one.jpg']);
    assert.equal(post.createdAt, '2020-09-13T12:26:40.000Z');
    return {
      url: 'https://ada.example/podsta/posts/saved.ttl',
      images: [...alreadyUploaded, 'https://ada.example/podsta/photos/two.jpg'],
    };
  };
  const prepareFile = async (file) => {
    assert.equal(file.type, 'image/jpeg');
    return { file: new File([new Uint8Array([7])], 'clean.jpg', { type: 'image/jpeg' }), thumbnail: null };
  };
  const keys = new Set(marked.map((post) => post.key));
  await assert.rejects(
    () =>
      runInstagramImport({
        posts: marked,
        keys,
        fs,
        audience: 'public',
        level: 'hidden',
        ledger,
        webId,
        prepareFile,
        uploadPost,
        pause: async () => {},
      }),
    (error) => {
      assert.match(error.message, /did not respond/);
      assert.equal(error.summary.saved, 0);
      return true;
    },
  );
  const partial = await ledger.get(ledgerKey(webId, marked[0].key));
  assert.equal(partial.status, 'partial');

  const summary = await runInstagramImport({
    posts: marked,
    keys,
    fs,
    audience: 'public',
    level: 'public',
    ledger,
    webId,
    prepareFile,
    uploadPost,
    pause: async () => {},
  });
  assert.equal(summary.saved, 1);
  assert.equal(summary.audience, 'public');
  assert.equal(uploads, 2);

  const again = await runInstagramImport({
    posts: marked.map((post) => ({ ...post, alreadyImported: false })),
    keys: new Set([marked[0].key]),
    fs,
    audience: 'contacts',
    level: 'contacts',
    ledger,
    webId,
    prepareFile,
    uploadPost,
    pause: async () => {},
  });
  assert.equal(again.skipped, 1);
  assert.equal(again.saved, 0);
  assert.equal(uploads, 2);
});
