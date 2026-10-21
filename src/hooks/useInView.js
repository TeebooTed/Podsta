import { useEffect, useRef, useState } from 'react';

/** True once the element is near the viewport. Stays true after that. */
export function useInView() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return undefined;
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return [ref, visible];
}
