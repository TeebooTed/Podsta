import { useId, useRef, useState } from 'react';
import { ONBOARDING_STEPS } from '../lib/onboarding.js';
import { DEFAULT_LEVEL, LEVEL_OPTIONS } from '../lib/discoverability.js';
import { displayHandle } from '../lib/handles.js';
import { currentAppRoot } from '../lib/appUrl.js';
import { inviteUrl } from '../lib/invite.js';
import { copyToClipboard } from '../lib/utils.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

/**
 * Skippable first-run tour. Skip and "Not now" both finish the tour
 * without requiring a post.
 */
export default function Onboarding({
  webId,
  initialName = '',
  initialLevel = DEFAULT_LEVEL,
  onSaveName,
  onSaveDiscoverability,
  onCompose,
  onDone,
  showToast,
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState(initialLevel || DEFAULT_LEVEL);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  const titleId = useId();
  useFocusTrap(true, panelRef);

  const current = ONBOARDING_STEPS[step];
  const last = step === ONBOARDING_STEPS.length - 1;

  const finish = () => onDone();

  const next = async () => {
    if (current.id === 'name' && name.trim() && name.trim() !== initialName) {
      setSaving(true);
      try {
        await onSaveName(name.trim());
      } catch (err) {
        showToast?.(`Could not save your name: ${err.message}`, 'error');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (current.id === 'visibility') {
      setSaving(true);
      try {
        await onSaveDiscoverability?.(level);
      } catch (err) {
        showToast?.(`Could not save discoverability: ${err.message}`, 'error');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (last) finish();
    else setStep((n) => n + 1);
  };

  const copy = async () => {
    const ok = await copyToClipboard(webId || '');
    showToast?.(ok ? 'WebID copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card w-full max-w-lg p-6 sm:p-8"
      >
        <p className="text-xs text-ink-300 mb-2">
          Step {step + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h2 id={titleId} className="display-serif text-3xl mb-3 text-balance">
          {current.title}
        </h2>
        <p className="text-sm text-ink-200 leading-relaxed mb-5">{current.body}</p>

        {current.id === 'name' && (
          <div className="mb-5">
            <label htmlFor="onboard-name" className="block text-xs font-medium text-ink-300 mb-1.5">
              Display name
            </label>
            <input
              id="onboard-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              className="input-field display-serif text-xl"
              maxLength={80}
              placeholder="Your name"
            />
          </div>
        )}

        {current.id === 'visibility' && (
          <fieldset className="mb-5 space-y-2">
            <legend className="sr-only">Discoverability</legend>
            {LEVEL_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`flex gap-3 items-start rounded-lg border px-3 py-3 cursor-pointer ${
                  level === option.id ? 'border-accent bg-accent/10' : 'border-ink-600'
                }`}
              >
                <input
                  type="radio"
                  name="onboard-discoverability"
                  value={option.id}
                  checked={level === option.id}
                  onChange={() => setLevel(option.id)}
                  className="mt-1 accent-accent shrink-0"
                />
                <span>
                  <span className="block text-sm font-medium text-ink-50">{option.label}</span>
                  <span className="block text-sm text-ink-200 mt-1 leading-relaxed">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {current.id === 'webid' && (
          <div className="mb-5 space-y-3">
            <p className="display-serif text-2xl">{displayHandle(webId).qualified || webId}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="text-xs font-mono bg-ink-900 px-3 py-2 rounded break-all flex-1">{webId}</code>
              <button type="button" onClick={copy} className="btn-secondary shrink-0">
                Copy WebID
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(inviteUrl(currentAppRoot(), webId));
                showToast?.(ok ? 'Invite link copied' : 'Copy failed', ok ? 'success' : 'error');
              }}
              className="btn-primary"
            >
              Copy invite link
            </button>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button type="button" onClick={finish} className="btn-ghost">
            Skip
          </button>
          <div className="flex gap-2 justify-end">
            {step > 0 && (
              <button type="button" onClick={() => setStep((n) => n - 1)} className="btn-secondary">
                Back
              </button>
            )}
            {last ? (
              <>
                <button type="button" onClick={finish} className="btn-secondary">
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    finish();
                    onCompose();
                  }}
                  className="btn-primary"
                >
                  Write a post
                </button>
              </>
            ) : (
              <button type="button" onClick={next} className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
