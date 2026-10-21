import { useCallback, useEffect, useState } from 'react';
import { applyTheme, readTheme, resolveTheme, writeTheme } from '../lib/theme.js';

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function useTheme() {
  const [preference, setPreference] = useState(() =>
    typeof window === 'undefined' ? 'system' : readTheme(window.localStorage),
  );
  const [systemDark, setSystemDark] = useState(() => Boolean(query()?.matches));

  useEffect(() => {
    const mq = query();
    if (!mq) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyTheme(document, resolved);
  }, [resolved]);

  const choose = useCallback((next) => {
    setPreference(writeTheme(window.localStorage, next));
  }, []);

  return { preference, resolved, choose };
}
