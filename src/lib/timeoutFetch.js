export const CROSS_POD_TIMEOUT_MS = 8000;

export function isNotFound(err) {
  return err?.statusCode === 404 || err?.response?.status === 404;
}

/** A rate limit or a browser CORS failure, not a refusal from the Pod. */
export function isTransientFetchError(err) {
  const status = err?.statusCode || err?.response?.status;
  if (status === 408 || status === 429 || status === 503) return true;
  if (err?.name === 'TypeError' || err?.name === 'AbortError') return true;
  return /failed to fetch|too long to respond|429/i.test(String(err?.message || ''));
}

export async function retryTransient(run, { attempts = 3, wait } = {}) {
  const pause = wait || ((attempt) => new Promise((resolve) => setTimeout(resolve, 3000 * attempt)));
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      last = err;
      if (!isTransientFetchError(err) || attempt === attempts) throw err;
      await pause(attempt);
    }
  }
  throw last;
}

/**
 * Wrap a fetch so a hung Pod cannot leave a spinner up forever.
 * The returned promise rejects even if the underlying fetch ignores AbortSignal.
 */
export function withTimeout(baseFetch = fetch, timeoutMs = CROSS_POD_TIMEOUT_MS) {
  const fetchFn = typeof baseFetch === 'function' ? baseFetch : fetch;
  return function timedFetch(input, init = {}) {
    const controller = new AbortController();
    const parent = init.signal;
    const onParentAbort = () => controller.abort();
    if (parent) {
      if (parent.aborted) controller.abort();
      else parent.addEventListener('abort', onParentAbort, { once: true });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        const err = new Error('The Pod took too long to respond');
        err.name = 'AbortError';
        reject(err);
      }, timeoutMs);

      const finish = (fn, value) => {
        clearTimeout(timer);
        parent?.removeEventListener('abort', onParentAbort);
        fn(value);
      };

      Promise.resolve()
        .then(() => fetchFn(input, { ...init, signal: controller.signal }))
        .then(
          (response) => finish(resolve, response),
          (err) => finish(reject, err),
        );
    });
  };
}
