/**
 * Upload progress from bytes actually handed to the request.
 * The bar stays short of 100% until the Pod responds.
 */

export function uploadRatio(sent, total) {
  const bytes = Number(sent) || 0;
  const size = Number(total) || 0;
  if (size <= 0 || bytes <= 0) return 0;
  return Math.min(0.9, bytes / size);
}

export function overallRatio(index, count, fileRatio, done = false) {
  if (done) return 1;
  const total = Number(count) || 0;
  if (total <= 0) return 0;
  const position = Math.max(0, Number(index) || 0);
  const current = Math.min(0.9, Math.max(0, Number(fileRatio) || 0));
  return Math.min(0.99, (position + current) / total);
}

export function progressBody(blob, onBytes) {
  if (!blob?.stream) return blob;
  const total = blob.size || 0;
  let sent = 0;
  const reader = blob.stream().getReader();
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      sent += value.byteLength;
      onBytes?.(sent, total);
      controller.enqueue(value);
    },
  });
}

function uploadInit(file, body, duplex) {
  const init = {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'If-None-Match': '*',
    },
    body,
  };
  if (duplex) init.duplex = 'half';
  return init;
}

/**
 * Prefer a streamed body so the progress bar can move with the bytes.
 * Cross-origin browsers refuse that stream after the preflight, and the PUT
 * never reaches the Pod. The same file is then sent as a normal body.
 */
export async function putPhotoFile({ url, file, fetchFn, onBytes }) {
  if (!url) throw new Error('Missing photo address');
  if (!file) throw new Error('Missing photo');
  const send = fetchFn || fetch;
  let response;
  try {
    const body = progressBody(file, onBytes);
    const duplex = typeof ReadableStream !== 'undefined' && body instanceof ReadableStream;
    response = await send(url, uploadInit(file, body, duplex));
  } catch (err) {
    const message = String(err?.message || '');
    const streamRejected = err?.name === 'TypeError' || /failed to fetch|duplex/i.test(message);
    if (!streamRejected) throw err;
    response = await send(url, uploadInit(file, file, false));
  }
  if (!response.ok) {
    const error = new Error(`Upload responded ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return url;
}
