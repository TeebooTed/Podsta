import { useState } from 'react';
import WeeklyPrompt from '../components/WeeklyPrompt.jsx';
import { dismissWeeklyPrompt, isWeeklyPromptDismissed } from '../lib/weeklyPrompt.js';

const PREVIEW_ID = 'https://preview.example/profile/card#me';
const PREVIEW_DAY = new Date(2026, 9, 21);

/** Local page for the weekly card. Nothing here is saved to a pod. */
export default function PromptPreview() {
  const [hidden, setHidden] = useState(() =>
    isWeeklyPromptDismissed(window.localStorage, PREVIEW_ID, PREVIEW_DAY),
  );
  const [opened, setOpened] = useState(false);

  const skip = () => {
    dismissWeeklyPrompt(window.localStorage, PREVIEW_ID, PREVIEW_DAY);
    setHidden(true);
  };

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="display-serif text-4xl mb-6">Prompt preview</h1>
      {hidden ? (
        <p className="text-ink-100">Hidden for this week.</p>
      ) : (
        <WeeklyPrompt prompt="Something green" onCompose={() => setOpened(true)} onDismiss={skip} />
      )}
      {opened && <p className="text-ink-50">Composer opened. The caption was left empty.</p>}
    </main>
  );
}
