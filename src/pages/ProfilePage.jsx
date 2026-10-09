import { useState, useRef, useEffect } from 'react';
import Avatar from '../components/Avatar.jsx';
import PostGrid from '../components/PostGrid.jsx';
import { saveProfile, uploadAvatar } from '../lib/profile.js';
import DiscoverabilitySettings from '../components/DiscoverabilitySettings.jsx';
import { DEFAULT_LEVEL } from '../lib/discoverability.js';
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from '../lib/vocab.js';
import { shortWebId, copyToClipboard } from '../lib/utils.js';
import { safeHttpUrl } from '../lib/urls.js';

/**
 * Your profile: name, bio, avatar, then your own posts as a grid.
 */
export default function ProfilePage({
  session,
  podUrl,
  profile,
  onProfileUpdated,
  showToast,
  posts,
  loading,
  friends,
  onCompose,
  onSetAudience,
  onSaveDiscoverability,
  contacts = [],
  onAddContact,
  onRemoveContact,
  onAddFollowing,
  contactBusy = false,
  onEdit,
  onDelete,
  togglingUrls,
  deletingUrls,
}) {
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [level, setLevel] = useState(profile?.discoverability || DEFAULT_LEVEL);
  const [savingLevel, setSavingLevel] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setName(profile?.name || '');
    setBio(profile?.bio || '');
    setAvatarUrl(profile?.avatarUrl || '');
    setLevel(profile?.discoverability || DEFAULT_LEVEL);
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
        discoverability: profile?.discoverability || DEFAULT_LEVEL,
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
      onProfileUpdated({ ...profile, name, bio, avatarUrl });
      setDirty(false);
      showToast('Profile saved');
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

  const publicCount = posts.filter((p) => p.audience === 'public' || p.isPublic).length;
  const contactsCount = posts.filter((p) => p.audience === 'contacts').length;

  const handleSaveLevel = async () => {
    setSavingLevel(true);
    try {
      await onSaveDiscoverability(level, { name, bio, avatarUrl });
      showToast('Discoverability saved');
    } catch (err) {
      showToast(`Discoverability was not saved: ${err.message}`, 'error');
    } finally {
      setSavingLevel(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <DiscoverabilitySettings
        level={level}
        inferred={profile?.discoverabilityInferred}
        onChange={setLevel}
        onSave={handleSaveLevel}
        saving={savingLevel}
        contacts={contacts}
        onAddContact={onAddContact}
        onRemoveContact={onRemoveContact}
        onAddFollowing={onAddFollowing}
        contactBusy={contactBusy}
      />

      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative shrink-0">
            <Avatar src={avatarUrl} name={name || 'You'} size="xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent hover:bg-accent-light text-ink-950 rounded-full flex items-center justify-center text-sm shadow-lg transition disabled:opacity-50"
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
            <h1 className="display-serif text-4xl leading-none">{name || 'Your profile'}</h1>
            <p className="text-sm text-ink-300">
              {posts.length} posts · {publicCount} public · {contactsCount} contacts · {friends.length} following
            </p>
            <div>
              <label htmlFor="profile-name" className="block text-xs font-medium text-ink-300 mb-1.5">
                Display name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => trackChange(setName)(e.target.value.slice(0, 80))}
                placeholder="Your name"
                className="input-field display-serif text-xl"
                maxLength={80}
              />
            </div>
            <div>
              <label htmlFor="profile-bio" className="block text-xs font-medium text-ink-300 mb-1.5">
                Bio
                <span className="text-ink-300 ml-2 font-normal">{bio.length}/280</span>
              </label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => trackChange(setBio)(e.target.value.slice(0, 280))}
                placeholder="A line or two about yourself"
                rows={3}
                className="input-field resize-none"
              />
            </div>
            {dirty && (
              <div className="flex justify-end">
                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="display-serif text-2xl mb-3">
          Posts
        </h2>
        <PostGrid
          posts={posts}
          loading={loading}
          session={session}
          podUrl={podUrl}
          onCompose={onCompose}
          onSetAudience={onSetAudience}
          discoverability={profile?.discoverability || DEFAULT_LEVEL}
          onEdit={onEdit}
          onDelete={onDelete}
          togglingUrls={togglingUrls}
          deletingUrls={deletingUrls}
          showToast={showToast}
        />
      </section>

      <section className="card p-6">
        <h2 className="display-serif text-xl mb-4">Identity</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-ink-300 mb-1">WebID</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all">
                {session?.info?.webId}
              </code>
              <button type="button" onClick={copyWebId} className="btn-ghost text-xs py-1 px-2">
                Copy
              </button>
            </div>
            <p className="text-xs text-ink-300 mt-1">Share this with friends so they can follow you.</p>
          </div>
          {safeHttpUrl(podUrl) && (
            <div>
              <p className="text-xs text-ink-300 mb-1">Pod URL</p>
              <a
                href={safeHttpUrl(podUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent hover:text-accent-light break-all"
              >
                {podUrl} ↗
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-300 mb-1">WebID host</p>
            <code className="text-xs font-mono text-ink-200">{shortWebId(session?.info?.webId)}</code>
          </div>
        </div>
      </section>
    </div>
  );
}
