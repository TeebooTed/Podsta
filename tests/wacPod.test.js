import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Store, Writer } from 'n3';
import { createTextPost, sharePost, unsharePost, editTextPost, deletePost } from '../src/lib/posts.js';
import { lockExistingComments, shareResources } from '../src/lib/acl.js';
import { aclGrantsPublicRead } from '../src/lib/aclTurtle.js';

const OWNER = 'https://owner.example/profile/card#me';

function startPod() {
  const files = new Map();
  const failOn = new Set();

  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const owner = req.headers.authorization === 'Bearer owner';

    if (failOn.has(path)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('injected failure');
      return;
    }

    const reading = req.method === 'GET' || req.method === 'HEAD';
    if (!owner && !(reading && anonymousMayRead(path, files))) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    if (req.method === 'PUT') {
      if (req.headers['if-none-match'] === '*' && files.has(path)) {
        res.writeHead(412);
        res.end('exists');
        return;
      }
      if (path.endsWith('.meta.acl') && !files.has(path.replace(/\.acl$/, ''))) {
        res.writeHead(404);
        res.end('missing resource');
        return;
      }
      const type = req.headers['content-type'] || 'application/octet-stream';
      const stored = body.length ? body : Buffer.from('@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<> a ldp:Container .\n');
      files.set(path, { body: stored, type: String(type).split(';')[0] });
      res.writeHead(201);
      res.end();
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const file = files.get(path);
      if (!file) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'Content-Type': file.type });
      if (req.method === 'HEAD') res.end();
      else res.end(file.body);
      return;
    }

    if (req.method === 'PATCH') {
      const current = files.get(path);
      if (!current) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      try {
        const next = await applySparqlUpdate(current.body.toString(), body.toString(), `http://127.0.0.1${path}`);
        files.set(path, { body: Buffer.from(next), type: 'text/turtle' });
        res.writeHead(205);
        res.end();
      } catch (err) {
        res.writeHead(400);
        res.end(String(err));
      }
      return;
    }

    if (req.method === 'DELETE') {
      if (!files.has(path)) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      files.delete(path);
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(405);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const podUrl = `http://127.0.0.1:${port}/`;
      const fetchOwner = (input, init = {}) => {
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', 'Bearer owner');
        return fetch(input, { ...init, headers });
      };
      resolve({
        server,
        podUrl,
        files,
        failOn,
        session: { info: { webId: OWNER, isLoggedIn: true }, fetch: fetchOwner },
      });
    });
  });
}

function parseTurtle(text, base) {
  if (!text.trim()) return [];
  return new Parser({ baseIRI: base }).parse(text);
}

function applySparqlUpdate(current, patch, base) {
  const store = new Store(parseTurtle(current, base));
  const block = (keyword) => {
    const match = patch.match(new RegExp(`${keyword}\\s*\\{([\\s\\S]*?)\\}\\s*;`));
    return match ? match[1] : '';
  };
  for (const quad of parseTurtle(block('DELETE DATA'), base)) store.removeQuad(quad);
  for (const quad of parseTurtle(block('INSERT DATA'), base)) store.addQuad(quad);
  const writer = new Writer({ format: 'Turtle' });
  writer.addQuads([...store]);
  return new Promise((resolve, reject) => {
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

function anonymousMayRead(path, files) {
  const direct = files.get(`${path}.acl`);
  if (direct && aclGrantsPublicRead(direct.body.toString())) return true;
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) return false;
  const parentAcl = files.get(`${trimmed.slice(0, slash + 1)}.acl`);
  if (!parentAcl) return false;
  const text = parentAcl.body.toString();
  return /acl:default/.test(text) && aclGrantsPublicRead(text);
}

test('share, edit, and delete round-trip on a WAC pod', async () => {
  const pod = await startPod();
  try {
    const postUrl = await createTextPost({
      podUrl: pod.podUrl,
      session: pod.session,
      title: 'Harbor',
      body: 'Kept on my Pod.',
    });
    const post = {
      url: postUrl,
      type: 'text',
      title: 'Harbor',
      body: 'Kept on my Pod.',
      caption: '',
      dateCreated: '2026-04-01T00:00:00.000Z',
      isPublic: false,
    };

    await sharePost({ post, podUrl: pod.podUrl, ownerWebId: OWNER, session: pod.session });

    const anonPost = await fetch(postUrl);
    assert.equal(anonPost.status, 200);
    assert.match(await anonPost.text(), /Kept on my Pod/);

    const indexUrl = `${pod.podUrl}podsta/public-index.ttl`;
    const anonIndex = await fetch(indexUrl);
    assert.equal(anonIndex.status, 200);
    assert.match(await anonIndex.text(), /Harbor/);

    const commentsAcl = pod.files.get('/podsta/comments/.acl').body.toString();
    assert.equal(commentsAcl.includes('foaf:Agent'), false);
    assert.equal(commentsAcl.includes('acl:Append'), false);
    assert.match(commentsAcl, /acl:default/);

    const commentWrite = await fetch(`${pod.podUrl}podsta/comments/stranger.ttl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: '<> <http://schema.org/text> "nope" .',
    });
    assert.equal(commentWrite.status, 403);

    await editTextPost({
      post: { ...post, isPublic: true },
      newTitle: 'Harbor at dusk',
      newBody: 'Updated on the Pod.',
      podUrl: pod.podUrl,
      ownerWebId: OWNER,
      session: pod.session,
    });
    const edited = await (await fetch(indexUrl)).text();
    assert.match(edited, /Harbor at dusk/);
    assert.equal(edited.includes('>Harbor<') || /"Harbor"/.test(edited), false);

    await deletePost({ post, podUrl: pod.podUrl, session: pod.session });
    const afterDelete = await (await fetch(indexUrl)).text();
    assert.equal(afterDelete.includes(postUrl), false);
    assert.equal((await fetch(postUrl)).status, 403);
  } finally {
    pod.server.close();
  }
});

test('lockExistingComments removes a public Append grant', async () => {
  const pod = await startPod();
  try {
    const container = `${pod.podUrl}podsta/comments/`;
    await pod.session.fetch(container, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
        'If-None-Match': '*',
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
      },
      body: '@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<> a ldp:Container .\n',
    });
    const oldAcl = `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
<#public>
  a acl:Authorization ;
  acl:accessTo <${container}> ;
  acl:default <${container}> ;
  acl:agentClass foaf:Agent ;
  acl:mode acl:Append, acl:Read .
`;
    await pod.session.fetch(`${container}.acl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: oldAcl,
    });

    await lockExistingComments({
      podUrl: pod.podUrl,
      ownerWebId: OWNER,
      session: pod.session,
    });

    const next = pod.files.get('/podsta/comments/.acl').body.toString();
    assert.equal(next.includes('acl:Append'), false);
    assert.equal(next.includes('foaf:Agent'), false);
    const anon = await fetch(container);
    assert.equal(anon.status, 403);
  } finally {
    pod.server.close();
  }
});

test('a partial ACL failure is reported as incomplete', async () => {
  const pod = await startPod();
  try {
    const ok = `${pod.podUrl}podsta/posts/one.ttl`;
    const bad = `${pod.podUrl}podsta/posts/two.ttl`;
    pod.failOn.add('/podsta/posts/two.ttl.acl');
    await assert.rejects(
      () => shareResources([ok, bad], OWNER, pod.session),
      /Share incomplete \(1 of 2 failed\)/,
    );
    assert.equal(pod.files.has('/podsta/posts/one.ttl.acl'), true);
  } finally {
    pod.server.close();
  }
});

test('unshare treats a missing caption file as already private', async () => {
  const pod = await startPod();
  try {
    const postUrl = await createTextPost({
      podUrl: pod.podUrl,
      session: pod.session,
      title: 'Photo stand-in',
      body: 'body',
    });
    await sharePost({
      post: {
        url: postUrl,
        type: 'text',
        title: 'Photo stand-in',
        body: 'body',
        dateCreated: '2026-04-01T00:00:00.000Z',
      },
      podUrl: pod.podUrl,
      ownerWebId: OWNER,
      session: pod.session,
    });
    await unsharePost({
      post: { url: postUrl, type: 'photo', caption: '' },
      podUrl: pod.podUrl,
      ownerWebId: OWNER,
      session: pod.session,
    });
    const anon = await fetch(postUrl);
    assert.equal(anon.status, 403);
  } finally {
    pod.server.close();
  }
});
