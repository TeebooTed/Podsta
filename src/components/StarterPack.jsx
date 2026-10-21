import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import InviteQr from './InviteQr.jsx';
import { displayHandle } from '../lib/handles.js';
import { currentAppRoot } from '../lib/appUrl.js';
import { copyToClipboard } from '../lib/utils.js';
import { samePerson, normalizeWebId } from '../lib/webId.js';
import {
  MAX_PACK_PEOPLE,
  loadOwnPack,
  packAppUrl,
  packResourceUrl,
  uniqueWebIds,
} from '../lib/pack.js';
import { savePack } from '../lib/packStore.js';

function personLabel(webId, name) {
  if (!name || name === webId || name === 'Unknown' || name === 'profile' || /^https?:\/\//i.test(name)) {
    return displayHandle(webId).handle || 'Someone';
  }
  return name;
}

function sameList(left, right) {
  if (left.length !== right.length) return false;
  return left.every((id, index) => samePerson(id, right[index]));
}

/**
 * One public list of addresses in this pod. The file holds addresses only.
 */
export default function StarterPack({ session, podUrl, friends = [], showToast }) {
  const [members, setMembers] = useState([]);
  const [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadOwnPack({ podUrl, fetchFn: session.fetch });
        if (cancelled) return;
        setMembers(loaded);
        setSaved(loaded);
        setShareUrl(loaded.length ? packAppUrl(currentAppRoot(), packResourceUrl(podUrl)) : '');
        setReady(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [podUrl, session]);

  const dirty = ready && !sameList(members, saved);

  const toggle = (webId) => {
    setMembers((prev) => {
      if (prev.some((id) => samePerson(id, webId))) return prev.filter((id) => !samePerson(id, webId));
      if (prev.length >= MAX_PACK_PEOPLE) {
        showToast('A pack can hold 50 people.', 'error');
        return prev;
      }
      return uniqueWebIds([...prev, webId]);
    });
  };

  const addAddress = (event) => {
    event.preventDefault();
    const normalized = normalizeWebId(address);
    if (!normalized) {
      showToast("That doesn't look like an address. Addresses start with https://", 'error');
      return;
    }
    if (members.some((id) => samePerson(id, normalized))) {
      showToast("They're already in this pack.");
      setAddress('');
      return;
    }
    if (members.length >= MAX_PACK_PEOPLE) {
      showToast('A pack can hold 50 people.', 'error');
      return;
    }
    setMembers((prev) => uniqueWebIds([...prev, normalized]));
    setAddress('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await savePack({ podUrl, session, webIds: members });
      setSaved(members);
      setShareUrl(packAppUrl(currentAppRoot(), packResourceUrl(podUrl)));
      showToast('Starter pack saved. Anyone with the link can follow these people.');
    } catch (err) {
      showToast(err?.message || "The pack didn't save. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    const ok = shareUrl ? await copyToClipboard(shareUrl) : false;
    showToast(ok ? 'Pack link copied' : "Couldn't copy that. The link is written below.", ok ? 'success' : 'error');
  };

  const extras = members.filter((id) => !friends.some((friend) => samePerson(friend.webId, id)));

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="starter-pack-heading">
      <h2 id="starter-pack-heading" className="display-serif text-2xl mb-2">
        Starter pack
      </h2>
      <p className="text-sm text-ink-100 leading-relaxed mb-4">
        A starter pack is a public list of addresses in your pod. Anyone with the link can follow
        them. Podsta doesn't keep a directory. Up to 50 people.
      </p>
      {loadError && (
        <p className="text-sm text-accent-ink mb-4" role="alert">
          Couldn't read the pack in your pod, so it wasn't replaced.
        </p>
      )}
      {!loadError && (
        <>
          {friends.length > 0 && (
            <ul className="space-y-2 mb-4">
              {friends.map((friend) => {
                const label = personLabel(friend.webId, friend.name);
                const checked = members.some((id) => samePerson(id, friend.webId));
                return (
                  <li key={friend.webId}>
                    <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent"
                        checked={checked}
                        onChange={() => toggle(friend.webId)}
                      />
                      <Avatar src={friend.avatarUrl} name={label} size="sm" />
                      <span className="text-sm font-bold truncate">{label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={addAddress} className="flex flex-col sm:flex-row gap-2 mb-3">
            <label htmlFor="pack-address" className="sr-only">
              Add an address
            </label>
            <input
              id="pack-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="https://…"
              className="input-field flex-1"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <button type="submit" className="btn-secondary">
              Add
            </button>
          </form>
          {extras.length > 0 && (
            <ul className="space-y-2 mb-3">
              {extras.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-xs">{id}</span>
                  <button type="button" className="btn-ghost text-sm" onClick={() => toggle(id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-300 mb-4">
            {members.length} of {MAX_PACK_PEOPLE}
          </p>
          <button type="button" className="btn-primary" onClick={save} disabled={!ready || saving || !dirty}>
            {saving ? 'Saving…' : 'Save pack'}
          </button>
          {shareUrl && (
            <div className="mt-6 flex flex-col sm:flex-row gap-5 items-start">
              <InviteQr url={shareUrl} label="Starter pack" />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs text-ink-200 mb-1">Pack link</p>
                  <code id="starter-pack-link" className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all block">
                    {shareUrl}
                  </code>
                </div>
                <button type="button" onClick={copyLink} className="btn-secondary">
                  Copy pack link
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
