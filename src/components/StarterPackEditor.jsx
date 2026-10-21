import { useState } from 'react';
import InviteQr from './InviteQr.jsx';
import { displayHandle } from '../lib/handles.js';
import { currentAppRoot } from '../lib/appUrl.js';
import { copyToClipboard } from '../lib/utils.js';
import { MAX_PACK_MEMBERS, MAX_PACK_NAME, packPagePath } from '../lib/starterPack.js';
import { saveStarterPack } from '../lib/starterPackStore.js';

/**
 * Pick people you already follow and publish that list on your pod.
 * The link and QR code open the pack. They do not create a directory.
 */
export default function StarterPackEditor({ session, podUrl, friends = [], showToast }) {
  const [name, setName] = useState('People to follow');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const toggle = (webId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(webId)) next.delete(webId);
      else if (next.size < MAX_PACK_MEMBERS) next.add(webId);
      return next;
    });
    setShareUrl('');
  };

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveStarterPack({
        podUrl,
        session,
        name,
        members: [...selected],
      });
      const page = `${currentAppRoot()}${packPagePath(saved.url)}`;
      setShareUrl(page);
      showToast('Starter pack saved on your pod');
    } catch (err) {
      showToast(err?.message || 'Could not save that starter pack', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const ok = await copyToClipboard(shareUrl);
    showToast(ok ? 'Pack link copied' : 'Could not copy that link', ok ? 'info' : 'error');
  };

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="pack-heading">
      <h2 id="pack-heading" className="display-serif text-2xl mb-2">
        Starter pack
      </h2>
      <p className="text-sm text-ink-100 leading-relaxed mb-4">
        Share a list of people you follow. Someone who opens the link or the QR code can follow
        them in one step. The list stays in your pod, and only the people you tick are on it.
      </p>
      {!friends.length ? (
        <p className="text-sm text-ink-200">Follow a few people first, then you can share them.</p>
      ) : (
        <>
          <label htmlFor="pack-name" className="block text-xs font-medium text-ink-200 mb-1.5">
            Name
          </label>
          <input
            id="pack-name"
            value={name}
            maxLength={MAX_PACK_NAME}
            onChange={(event) => {
              setName(event.target.value.slice(0, MAX_PACK_NAME));
              setShareUrl('');
            }}
            className="input-field mb-4"
          />
          <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {friends.map((friend) => {
              const handle = displayHandle(friend.webId).qualified || friend.webId;
              const checked = selected.has(friend.webId);
              return (
                <li key={friend.webId}>
                  <label className="flex items-center gap-3 min-h-11 text-sm text-ink-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(friend.webId)}
                    />
                    <span className="min-w-0 break-words">{friend.name || handle}</span>
                    <span className="text-ink-200 truncate">{handle}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || selected.size === 0}
            onClick={save}
          >
            {busy ? 'Saving…' : `Save pack (${selected.size})`}
          </button>
        </>
      )}
      {shareUrl && (
        <div className="mt-5 flex flex-col sm:flex-row gap-5 items-start">
          <InviteQr url={shareUrl} label="Starter pack link" />
          <div className="min-w-0 flex-1 space-y-3">
            <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all block">
              {shareUrl}
            </code>
            <button type="button" className="btn-secondary" onClick={copy}>
              Copy pack link
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
