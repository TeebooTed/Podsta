import { useState } from 'react';
import CalmCountsSetting from '../components/CalmCountsSetting.jsx';
import LikeControl from '../components/LikeControl.jsx';

/** Local page for the likes setting. Nothing here is saved to a pod. */
export default function CalmPreview() {
  const [hide, setHide] = useState(true);
  return (
    <main className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="display-serif text-4xl">Likes preview</h1>
      <CalmCountsSetting hide={hide} onChange={setHide} />
      <article className="card p-4" aria-label="Your post">
        <p className="text-sm font-extrabold text-ink-50 mb-2">Your post</p>
        <LikeControl liked count={3} names={['You', 'A friend']} />
      </article>
      <article className="card p-4" aria-label="Someone else's view">
        <p className="text-sm font-extrabold text-ink-50 mb-2">What other people see</p>
        <LikeControl
          liked
          count={hide ? null : 3}
          names={hide ? [] : ['You', 'A friend']}
        />
      </article>
    </main>
  );
}
