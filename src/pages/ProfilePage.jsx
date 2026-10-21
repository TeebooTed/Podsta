import { useState, useRef, useEffect } from 'react';
import Avatar from '../components/Avatar.jsx';
import PostGrid from '../components/PostGrid.jsx';
import { saveProfile, uploadAvatar, uploadCover } from '../lib/profile.js';
import { deleteOldCover, pinnedFrom, saveProfileExtras } from '../lib/profileExtras.js';
import ProfileCover from '../components/ProfileCover.jsx';
import PinnedPosts, { PinPicker } from '../components/PinnedPosts.jsx';
import ProfileShareCard from '../components/ProfileShareCard.jsx';
import DiscoverabilitySettings from '../components/DiscoverabilitySettings.jsx';
import { DEFAULT_LEVEL } from '../lib/discoverability.js';
import { useLikes } from '../hooks/useLikes.js';
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from '../lib/vocab.js';
import { copyToClipboard } from '../lib/utils.js';
import { safeHttpUrl } from '../lib/urls.js';
import { displayHandle } from '../lib/handles.js';
import { currentAppRoot } from '../lib/appUrl.js';
import { inviteUrl } from '../lib/invite.js';
import InviteQr from '../components/InviteQr.jsx';
import PullIndicator from '../components/PullIndicator.jsx';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import InstagramImport from '../components/InstagramImport.jsx';

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
  onRefresh,
  onLibraryChanged,
}) {
  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pullState = usePullToRefresh(
    async () => {
      setRefreshing(true);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    },
    { enabled: Boolean(onRefresh) && !refreshing, refreshing },
  );
  const [dirty, setDirty] = useState(false);
  const [level, setLevel] = useState(profile?.discoverability || DEFAULT_LEVEL);
  const [savingLevel, setSavingLevel] = useState(false);
  const fileRef = useRef(null);
  const [coverUrl, setCoverUrl] = useState(profile?.coverUrl || '');
  const [coverBusy, setCoverBusy] = useState(false);
  const [pinned, setPinned] = useState(profile?.pinned || []);
  const [pickingPins, setPickingPins] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    setCoverUrl(profile?.coverUrl || '');
    setPinned(profile?.pinned || []);
  }, [profile]);

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
      showToast("We can't use that file. Podsta takes JPEG, PNG, GIF and WebP photos.", 'error');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast(
        'That photo is too big. Each one can be up to 10 MB. Try a smaller copy, or crop it first.',
        'error',
      );
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

  const saveCover = async (next, file) => {
    setCoverBusy(true);
    try {
      const url = file
        ? await uploadCover({
            podUrl,
            session,
            file,
            ownerWebId: session.info.webId,
            discoverability: profile?.discoverability || DEFAULT_LEVEL,
          })
        : next;
      await saveProfileExtras({ podUrl, session, coverUrl: url });
      deleteOldCover({ podUrl, session, oldUrl: coverUrl, newUrl: url });
      setCoverUrl(url);
      onProfileUpdated({ ...profile, coverUrl: url });
      showToast(url ? 'Cover saved' : 'Cover removed');
    } catch (err) {
      showToast("We couldn't save that to your pod. Try again in a moment.", 'error');
      console.error('Cover save failed:', err);
    } finally {
      setCoverBusy(false);
    }
  };

  const handleCoverFile = (file) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast("We can't use that file. Podsta takes JPEG, PNG, GIF and WebP photos.", 'error');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('That photo is too big. Each one can be up to 10 MB. Try a smaller copy.', 'error');
      return;
    }
    saveCover('', file);
  };

  const savePins = async (next) => {
    setSavingPins(true);
    try {
      await saveProfileExtras({ podUrl, session, pinned: next });
      setPinned(next);
      onProfileUpdated({ ...profile, pinned: next });
      setPickingPins(false);
      showToast(next.length ? 'Pins saved' : 'Pins cleared');
    } catch (err) {
      showToast("We couldn't save that to your pod. Try again in a moment.", 'error');
      console.error('Pin save failed:', err);
    } finally {
      setSavingPins(false);
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
      showToast("We couldn't save that to your pod. Try again in a moment.", 'error');
      console.error('Profile save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const ownWebId = session?.info?.webId || '';
  const [blockRevision, setBlockRevision] = useState(0);
  const likes = useLikes({
    enabled: Boolean(session?.info?.isLoggedIn && podUrl),
    session,
    podUrl,
    webId: ownWebId,
    posts,
    blockRevision,
  });

  const onToggleLike = async (post) => {
    try {
      const result = await likes.toggle({ ...post, ownerWebId: ownWebId, audience: post.audience });
      if (!result) return;
      if (result.queued) {
        showToast("Saved on this device. It will send when your pod answers.", 'info');
        return;
      }
      if (!result.liked) showToast('Like removed');
      else if (result.notified) showToast('Liked');
      else showToast("Liked on your pod. The count didn't update.", 'info');
    } catch (err) {
      showToast(err.message || 'Could not save that like', 'error');
    }
  };
  const ownHandle = displayHandle(ownWebId);
  const ownInvite =
    ownWebId && typeof window !== 'undefined' ? inviteUrl(currentAppRoot(), ownWebId) : '';

  const copyAddress = async () => {
    const ok = await copyToClipboard(ownWebId);
    showToast(
      ok ? 'Address copied' : "Couldn't copy that. Try selecting it instead.",
      ok ? 'success' : 'error',
    );
  };

  const copyInvite = async () => {
    const ok = await copyToClipboard(ownInvite);
    showToast(
      ok ? 'Invite link copied' : "Couldn't copy that. Try selecting it instead.",
      ok ? 'success' : 'error',
    );
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
      <PullIndicator {...pullState} />
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

      <section className="card overflow-hidden p-6 pt-0 sm:p-8 sm:pt-0">
        <ProfileCover
          url={coverUrl}
          fetchFn={session?.fetch}
          editable
          busy={coverBusy}
          onPick={handleCoverFile}
          onRemove={() => saveCover('')}
          className="-mx-6 sm:-mx-8 mb-4"
        />
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative shrink-0 -mt-14 sm:-mt-12">
            <Avatar
              src={avatarUrl}
              name={name || 'You'}
              size="xl"
              className="ring-4 ring-ink-800 shadow-lift"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent hover:bg-accent-light text-plum rounded-full flex items-center justify-center text-sm shadow-lg transition disabled:opacity-50"
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
              {posts.length} posts · {publicCount} public · {contactsCount} contacts ·{' '}
              {friends.length} following
            </p>
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-medium text-ink-300 mb-1.5"
              >
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
              <label
                htmlFor="profile-bio"
                className="block text-xs font-medium text-ink-300 mb-1.5"
              >
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
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {(pinned.length > 0 || posts.some((post) => post.audience === 'public' || post.isPublic)) && (
        <PinnedPosts
          posts={pinnedFrom(pinned, posts)}
          ownerView
          onEdit={() => setPickingPins(true)}
        />
      )}

      <section className="card p-6 sm:p-8" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="display-serif text-2xl mb-2">
          Invite
        </h2>
        <p className="text-sm text-ink-100 leading-relaxed mb-4">
          Send this link or the QR code. It opens your profile with a Follow button.
          {ownHandle.qualified ? ` People see ${ownHandle.qualified}.` : ''} The short name comes
          from your address, and nobody else can claim it. A Hidden or Contacts profile still hides
          posts from anyone you haven't allowed.
        </p>
        {ownHandle.qualified && (
          <p className="display-serif text-3xl mb-3">{ownHandle.qualified}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {ownInvite && <InviteQr url={ownInvite} />}
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs text-ink-200 mb-1">Invite link</p>
              <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all block">
                {ownInvite}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyInvite} className="btn-primary">
                Copy invite link
              </button>
              <button type="button" onClick={copyAddress} className="btn-secondary">
                Copy my address
              </button>
              {ownInvite && (
                <button type="button" onClick={() => setCardOpen(true)} className="btn-secondary">
                  Make a profile card
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <InstagramImport
        session={session}
        podUrl={podUrl}
        discoverability={profile?.discoverability || DEFAULT_LEVEL}
        showToast={showToast}
        onImported={onLibraryChanged}
      />

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
          onBlocksChanged={() => setBlockRevision((value) => value + 1)}
          likeFor={(post) => likes.view(post)}
          onToggleLike={onToggleLike}
          likeBusyUrl={likes.busyUrl}
        />
      </section>

      <section className="card p-6">
        <h2 className="display-serif text-xl mb-4">Identity</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-ink-300 mb-1">Address</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all">
                {ownWebId}
              </code>
              <button type="button" onClick={copyAddress} className="btn-ghost text-xs py-1 px-2">
                Copy
              </button>
            </div>
            <p className="text-xs text-ink-300 mt-1">
              Share this with friends so they can follow you.
            </p>
          </div>
          {safeHttpUrl(podUrl) && (
            <div>
              <p className="text-xs text-ink-300 mb-1">Your pod</p>
              <a
                href={safeHttpUrl(podUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent-ink hover:underline break-all"
              >
                {podUrl} ↗
              </a>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-200 mb-1">Short name</p>
            <code className="text-xs font-mono text-ink-100">
              {ownHandle.qualified || ownWebId}
            </code>
            <p className="text-xs text-ink-200 mt-1">
              Taken from your address. Podsta doesn't keep a list of names, so your invite link is
              the surest way for friends to find you.
            </p>
          </div>
        </div>
      </section>

      <PinPicker
        open={pickingPins}
        onClose={() => setPickingPins(false)}
        posts={posts}
        pinned={pinned}
        onSave={savePins}
        saving={savingPins}
      />
      <ProfileShareCard
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        name={name}
        handle={ownHandle.qualified}
        bio={bio}
        avatarUrl={avatarUrl}
        coverUrl={coverUrl}
        inviteUrl={ownInvite}
        fetchFn={session?.fetch}
        showToast={showToast}
      />
    </div>
  );
}
