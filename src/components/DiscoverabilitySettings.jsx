import { useState } from 'react';
import { LEVEL_OPTIONS } from '../lib/discoverability.js';
import { normalizeWebId } from '../lib/webId.js';
import { shortWebId } from '../lib/utils.js';

/**
 * Profile discoverability. Saving is separate from the name and bio,
 * because it rewrites access control on the Pod.
 */
export default function DiscoverabilitySettings({
  level,
  inferred = false,
  onChange,
  onSave,
  saving = false,
  contacts = [],
  onAddContact,
  onRemoveContact,
  onAddFollowing,
  contactBusy = false,
}) {
  const [webId, setWebId] = useState('');
  const [localError, setLocalError] = useState('');

  const add = async (event) => {
    event?.preventDefault?.();
    const next = normalizeWebId(webId);
    if (!next) {
      setLocalError('Enter a WebID that starts with https://');
      return;
    }
    setLocalError('');
    try {
      await onAddContact(next);
      setWebId('');
    } catch (err) {
      setLocalError(err.message || 'Could not add that contact');
    }
  };

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="discoverability-heading">
      <h2 id="discoverability-heading" className="display-serif text-2xl mb-2">
        Discoverability
      </h2>
      <p className="text-sm text-ink-200 leading-relaxed mb-4">
        Recommended: Hidden. Contacts are people you explicitly approve. Following someone fills your feed. It does not let them see your posts.
      </p>
      {inferred && (
        <p className="text-sm text-ink-200 mb-4">
          This level is inferred from your Pod. Save it to record the choice.
        </p>
      )}

      <fieldset className="space-y-3">
        <legend className="sr-only">Who can find you</legend>
        {LEVEL_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`flex gap-3 items-start rounded-lg border px-3 py-3 cursor-pointer min-h-8 ${
              level === option.id ? 'border-accent bg-accent/10' : 'border-ink-600'
            }`}
          >
            <input
              type="radio"
              name="discoverability"
              value={option.id}
              checked={level === option.id}
              onChange={() => onChange(option.id)}
              className="mt-1 accent-accent shrink-0"
            />
            <span>
              <span className="block text-sm font-medium text-ink-50">{option.label}</span>
              <span className="block text-sm text-ink-200 mt-1 leading-relaxed">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-sm text-ink-200 mt-4 leading-relaxed">
        Saving pulls posts that are more open than this level back down. It does not publish posts you marked Only me.
      </p>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save discoverability'}
        </button>
      </div>

      {level === 'contacts' && (
        <div className="mt-6 pt-5 border-t border-ink-700">
          <h3 className="text-sm font-medium text-ink-50 mb-2">Approved contacts</h3>
          <p className="text-sm text-ink-200 leading-relaxed mb-4">
            While Contacts sharing is on, this list is world-readable. Solid reads the group file to check membership. The posts themselves stay limited to these people.
          </p>
          {contacts.length === 0 ? (
            <p className="text-sm text-ink-200 mb-3">No approved contacts yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {contacts.map((id) => (
                <li key={id} className="flex items-center gap-2 justify-between">
                  <code className="text-xs font-mono text-ink-100 break-all">{shortWebId(id)}</code>
                  <button
                    type="button"
                    onClick={() => onRemoveContact(id)}
                    disabled={contactBusy}
                    className="btn-secondary text-xs shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="contact-webid" className="sr-only">
              WebID to approve
            </label>
            <input
              id="contact-webid"
              type="url"
              value={webId}
              onChange={(e) => setWebId(e.target.value)}
              placeholder="https://example.com/profile/card#me"
              className="input-field flex-1 font-mono text-xs"
            />
            <button type="submit" className="btn-secondary shrink-0" disabled={contactBusy || !webId.trim()}>
              Approve
            </button>
          </form>
          {localError && (
            <p className="mt-2 text-sm text-accent" role="alert">
              {localError}
            </p>
          )}
          <button
            type="button"
            onClick={onAddFollowing}
            disabled={contactBusy}
            className="btn-secondary mt-3"
          >
            Add the people I follow
          </button>
        </div>
      )}
    </section>
  );
}
