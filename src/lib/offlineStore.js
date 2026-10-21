const DB_NAME = 'podsta-offline';
const STORE = 'snapshots';

export function snapshotKey(kind, webId) {
  return `${kind}:${webId || 'anonymous'}`;
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function writeSnapshot(key, value) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ value, savedAt: Date.now() }, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readSnapshot(key) {
  const db = await openDb();
  if (!db) return null;
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return row?.value || null;
}
