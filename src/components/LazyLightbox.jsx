import { lazy, Suspense } from 'react';

const Lightbox = lazy(() => import('./Lightbox.jsx'));

/** The viewer is only needed after a photo is opened. */
export default function LazyLightbox(props) {
  return (
    <Suspense fallback={null}>
      <Lightbox {...props} />
    </Suspense>
  );
}
