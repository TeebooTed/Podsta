import { useState, useRef, useEffect } from 'react';
import Avatar from '../components/Avatar.jsx';
import { saveProfile, uploadAvatar } from '../lib/profile.js';
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from '../lib/vocab.js';
import { shortWebId, copyToClipboard } from '../lib/utils.js';

/**
 * Profile editor — name, bio, avatar.
 * On save, writes to /podsta/profile.ttl in the user's pod and makes it
 * publicly readable so other users can see it via discovery / feed cards.
 */
export default function ProfilePage({
  session,
  podUrl,
  profile,
  onProfileUpdated,
  showToast,
  posts,
  friends,
}) {
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setName(profile?.name || '');
    setBio(profile?.bio || '');
    setAvatarUrl(profile?.avatarUrl || '');
    setDirty(false);
  }, [profile]);

  const trackChange = (setter) => (value) => {
    setter(value);
    setDirty(true);
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast('Avatar must be a JPEG, PNG, GIF, or WebP', 'error');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('Avatar too large (max 10MB)', 'error');
      return;
    }
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar({
        podUrl,
        session,
        file,
        ownerWebId: session.info.webId,
      });
      setAvatarUrl(url);
      setDirty(true);
      showToast('Avatar uploaded — save to apply');
    } catch (err) {
      showToast(`Avatar upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({
        podUrl,
        session,
        ownerWebId: session.info.webId,
        profile: { name, bio, avatarUrl },
      });
      onProfileUpdated({ name, bio, avatarUrl });
      setDirty(false);
      showToast('Profile saved — visible to everyone');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyWebId = async () => {
    const ok = await copyToClipboard(session.info.webId);
    showToast(ok ? 'WebID copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  const stats = {
    total: posts.length,
    photos: posts.filter((p) => p.type === 'photo').length,
    text: posts.filter((p) => p.type === 'text').length,
    public: posts.filter((p) => p.isPublic).length,
    friends: friends.length,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Identity card */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative shrink-0">
            <Avatar src={avatarUrl} name={name || 'You'} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent hover:bg-accent-light text-ink-50 rounded-full flex items-center justify-center text-sm shadow-lg transition disabled:opacity-50"
              title="Change avatar"
              aria-label="Change avatar"
            >
              {uploadingAvatar ? '…' : '✎'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4 w-full">
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">
                Display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => trackChange(setName)(e.target.value.slice(0, 80))}
                placeholder="Your name"
                className="input-field display-serif text-xl"
                maxLength={80}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">
                Bio
                <span className="text-ink-400 ml-2 font-normal">{bio.length}/280</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => trackChange(setBio)(e.target.value.slice(0, 280))}
                placeholder="A line or two about yourself"
                rows={3}
                className="input-field resize-none"
              />
            </div>
            {dirty && (
              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Identity / Pod info */}
      <section className="card p-6">
        <h2 className="display-serif text-xl mb-4">Identity</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-ink-400 mb-1">WebID</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all">
                {session?.info?.webId}
              </code>
              <button onClick={copyWebId} className="btn-ghost text-xs py-1 px-2">
                Copy
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-1">
              Share this with friends so they can follow you.
            </p>
          </div>
          {podUrl && (
            <div>
              <p className="text-xs text-ink-400 mb-1">Pod URL</p>
              <a
                href={podUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent hover:text-accent-light break-all"
              >
                {podUrl} ↗
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-400 mb-1">Identity provider</p>
            <code className="text-xs font-mono text-ink-200">
              {shortWebId(session?.info?.webId)}
            </code>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="card p-6">
        <h2 className="display-serif text-xl mb-4">Your activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Photos', value: stats.photos },
            { label: 'Text', value: stats.text },
            { label: 'Public', value: stats.public },
            { label: 'Following', value: stats.friends },
          ].map((s) => (
            <div key={s.label}>
              <p className="display-serif text-3xl text-accent">{s.value}</p>
              <p className="text-xs text-ink-400 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About / Help */}
      <section className="card p-6">
        <h2 className="display-serif text-xl mb-2">About Podsta</h2>
        <p className="text-sm text-ink-300 leading-relaxed mb-3">
          Podsta is a social network without a server. Your posts, photos, and friends list
          all live in your Solid Pod — a personal data store you own. We just provide the
          interface to read and write to your Pod, and discover what your friends have shared.
        </p>
        <ul className="text-sm text-ink-300 space-y-1.5 list-disc list-inside leading-relaxed">
          <li>You decide what's public and what stays private.</li>
          <li>You can leave any time — your data stays in your Pod.</li>
          <li>No algorithms, no ads, no surveillance.</li>
        </ul>
        <div className="mt-4 flex gap-3 flex-wrap">
          <a
            href="https://solidproject.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            What is Solid? ↗
          </a>
        </div>
      </section>
    </div>
  );
}
