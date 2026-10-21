/**
 * Read a zip file one entry at a time.
 * Only the central directory and the entry being opened are loaded, so a large
 * Instagram export does not have to sit in memory all at once.
 * Stored entries and deflate entries are supported. Encrypted entries are not.
 */

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ZIP64_EXTRA = 0x0001;

export const MAX_ZIP_ENTRY_BYTES = 40 * 1024 * 1024;

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readU64(bytes, offset) {
  const low = readU32(bytes, offset);
  const high = readU32(bytes, offset + 4);
  return high * 0x100000000 + low;
}

async function readSlice(blob, start, end) {
  const chunk = blob.slice(start, end);
  return new Uint8Array(await chunk.arrayBuffer());
}

function findSignature(bytes, signature) {
  for (let index = bytes.length - 4; index >= 0; index -= 1) {
    if (readU32(bytes, index) === signature) return index;
  }
  return -1;
}

function zip64Sizes(extra, flags) {
  const out = {};
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const id = readU16(extra, offset);
    const size = readU16(extra, offset + 2);
    const start = offset + 4;
    if (id === ZIP64_EXTRA && start + size <= extra.length) {
      let cursor = start;
      if (flags.uncompressed) {
        out.uncompressedSize = readU64(extra, cursor);
        cursor += 8;
      }
      if (flags.compressed) {
        out.compressedSize = readU64(extra, cursor);
        cursor += 8;
      }
      if (flags.offset) {
        out.localOffset = readU64(extra, cursor);
      }
      return out;
    }
    offset = start + size;
  }
  return out;
}

function decodeName(bytes) {
  return new TextDecoder('utf-8').decode(bytes).replaceAll('\\', '/');
}

async function readEnd(blob) {
  const size = blob.size;
  if (!size || size < 22) throw new Error("This doesn't look like a zip file.");
  const tailSize = Math.min(size, 22 + 65535 + 64);
  const tail = await readSlice(blob, size - tailSize, size);
  const eocdAt = findSignature(tail, EOCD);
  if (eocdAt < 0) throw new Error("This doesn't look like a zip file.");
  const commentLength = readU16(tail, eocdAt + 20);
  if (eocdAt + 22 + commentLength > tail.length) throw new Error("This zip file is incomplete.");

  let entryCount = readU16(tail, eocdAt + 10);
  let directorySize = readU32(tail, eocdAt + 12);
  let directoryOffset = readU32(tail, eocdAt + 16);
  const needsZip64 = entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;
  if (!needsZip64) return { entryCount, directorySize, directoryOffset };

  const locatorAt = findSignature(tail.subarray(0, eocdAt), ZIP64_LOCATOR);
  if (locatorAt < 0) throw new Error('This zip uses a large-archive header Podsta could not read.');
  const zip64Offset = readU64(tail, locatorAt + 8);
  const zip64 = await readSlice(blob, zip64Offset, zip64Offset + 56);
  if (readU32(zip64, 0) !== ZIP64_EOCD) throw new Error('This zip uses a large-archive header Podsta could not read.');
  entryCount = readU64(zip64, 32);
  directorySize = readU64(zip64, 40);
  directoryOffset = readU64(zip64, 48);
  return { entryCount, directorySize, directoryOffset };
}

/**
 * Central directory only. File bytes stay in the zip until an entry is read.
 */
export async function listZipEntries(blob) {
  const end = await readEnd(blob);
  if (end.directorySize > MAX_ZIP_ENTRY_BYTES) {
    throw new Error('This zip has too many files to open on this device.');
  }
  const directory = await readSlice(blob, end.directoryOffset, end.directoryOffset + end.directorySize);
  const entries = [];
  let offset = 0;
  while (offset + 46 <= directory.length) {
    if (readU32(directory, offset) !== CENTRAL) break;
    const flags = readU16(directory, offset + 8);
    const method = readU16(directory, offset + 10);
    let compressedSize = readU32(directory, offset + 20);
    let uncompressedSize = readU32(directory, offset + 24);
    const nameLength = readU16(directory, offset + 28);
    const extraLength = readU16(directory, offset + 30);
    const commentLength = readU16(directory, offset + 32);
    let localOffset = readU32(directory, offset + 42);
    const nameStart = offset + 46;
    const nameBytes = directory.subarray(nameStart, nameStart + nameLength);
    const extra = directory.subarray(nameStart + nameLength, nameStart + nameLength + extraLength);
    const zip64 = zip64Sizes(extra, {
      uncompressed: uncompressedSize === 0xffffffff,
      compressed: compressedSize === 0xffffffff,
      offset: localOffset === 0xffffffff,
    });
    if (zip64.uncompressedSize != null) uncompressedSize = zip64.uncompressedSize;
    if (zip64.compressedSize != null) compressedSize = zip64.compressedSize;
    if (zip64.localOffset != null) localOffset = zip64.localOffset;
    const name = decodeName(nameBytes);
    if (name && !name.endsWith('/') && !name.split('/').includes('..')) {
      entries.push({
        name,
        method,
        flags,
        compressedSize,
        uncompressedSize,
        localOffset,
      });
    }
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot unpack the zip.');
  }
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_ZIP_ENTRY_BYTES) throw new Error('A file in the zip is too large to open on this device.');
    chunks.push(step.value);
  }
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return out;
}

export async function readZipEntry(blob, entry) {
  if (entry.flags & 0x1) throw new Error('This zip is password protected.');
  if (entry.uncompressedSize > MAX_ZIP_ENTRY_BYTES) {
    throw new Error('A file in the zip is too large to open on this device.');
  }
  const header = await readSlice(blob, entry.localOffset, entry.localOffset + 30);
  if (header.length < 30 || readU32(header, 0) !== LOCAL) throw new Error('This zip file is incomplete.');
  const nameLength = readU16(header, 26);
  const extraLength = readU16(header, 28);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = await readSlice(blob, dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRaw(compressed);
  throw new Error('This zip uses a compression Podsta cannot read.');
}

/**
 * A file map that reads one zip entry when asked.
 */
export async function openZip(file) {
  if (!file || typeof file.slice !== 'function') throw new Error('Choose a zip file.');
  const entries = await listZipEntries(file);
  const byName = new Map();
  for (const entry of entries) byName.set(entry.name, entry);
  return {
    kind: 'zip',
    async list() {
      return [...byName.values()].map((entry) => ({ path: entry.name, size: entry.uncompressedSize }));
    },
    async read(path) {
      const entry = byName.get(path);
      if (!entry) throw new Error('That file is not in the zip.');
      return readZipEntry(file, entry);
    },
  };
}
