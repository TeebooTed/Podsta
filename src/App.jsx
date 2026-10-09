import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { restoreSession, logout, findPodUrl } from './lib/auth.js';
import { lockExistingComments } from './lib/acl.js';
import { postedToast } from './lib/shareFeedback.js';
import {
  loadOwnPosts,
  uploadPhoto,
  createTextPost,
  sharePost,
  unsharePost,
  editPhotoCaption,
  editTextPost,
  deletePost,
} from './lib/posts.js';
import { loadFriends, addFriend, removeFriend } from './lib/friends.js';
import { loadProfile, saveProfile } from './lib/profile.js';
import { hasFinishedOnboarding, markOnboardingDone } from './lib/onboarding.js';
import LoginPage from './pages/LoginPage.jsx';
import HomePage from './pages/HomePage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import PersonPage from './pages/PersonPage.jsx';
import PostPage from './pages/PostPage.jsx';
import Header from './components/Header.jsx';
import BottomNav from './components/BottomNav.jsx';
import Onboarding from './components/Onboarding.jsx';
import Composer from './components/Composer.jsx';
import Toast from './components/Toast.jsx';

/**
 * Top-level component. Holds:
 *   - Session and pod URL (set after auth resolves)
 *   - Profile, posts, friends (lazy-loaded after login)
 *   - In-flight operation tracking (for optimistic UI on toggles/deletes)
 *   - Current tab + composer modal state
 *
 * State updates flow downward; async ops bubble up via callbacks. We keep the
 * App component as flat as possible — page components own their own
 * intra-page UI state (lightbox open, scroll position, etc.).
 */
export default function App() {
  // ── Auth / boot ───────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [podUrl, setPodUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  // ── App state (only meaningful when logged in) ────────────
  const [profile, setProfile] = useState({ name: '', bio: '', avatarUrl: '' });
  const [posts, setPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const navigate = useNavigate();

  // ── Per-resource in-flight trackers (so cards know to disable buttons) ──
  const [togglingUrls, setTogglingUrls] = useState(new Set());
  const [deletingUrls, setDeletingUrls] = useState(new Set());
  const [addingWebId, setAddingWebId] = useState(null);

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // Used to abort in-flight loads if the user logs out mid-load.
  const sessionGenRef = useRef(0);

  // ── Boot: restore session, find pod, load data ────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await restoreSession();
        if (cancelled) return;
        setSession(s);

        if (s?.info?.isLoggedIn) {
          const gen = ++sessionGenRef.current;
          const pod = await findPodUrl(s);
          if (cancelled || gen !== sessionGenRef.current) return;
          setPodUrl(pod);

          if (!pod) {
            setAuthError(
              'Could not find a Pod for your WebID. Please ensure your profile lists at least one pim:storage.',
            );
          } else {
            // Load profile, posts, friends in parallel.
            setLoadingPosts(true);
            const [prof, postsList, friendsList] = await Promise.all([
              loadProfile({ podUrl: pod, session: s }).catch(() => ({
                name: '',
                bio: '',
                avatarUrl: '',
              })),
              loadOwnPosts({ podUrl: pod, session: s }).catch((err) => {
                console.error('Posts load failed:', err);
                showToast('Could not load posts', 'error');
                return [];
              }),
              loadFriends({ podUrl: pod, session: s }).catch(() => []),
              lockExistingComments({
                podUrl: pod,
                ownerWebId: s.info.webId,
                session: s,
              }).catch((err) => {
                console.warn('Could not lock comments to the owner:', err);
              }),
            ]);
            if (cancelled || gen !== sessionGenRef.current) return;
            setProfile(prof);
            setPosts(postsList);
            setFriends(friendsList);
            setLoadingPosts(false);
            if (!hasFinishedOnboarding(window.localStorage, s.info.webId)) {
              setOnboardingOpen(true);
            }
          }
        }
      } catch (err) {
        console.error('Boot failed:', err);
        if (!cancelled) setAuthError(err.message || 'Something went wrong on startup');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ── Reload posts (called after compose, edit, delete) ─────
  const reloadPosts = useCallback(async () => {
    if (!podUrl || !session?.info?.isLoggedIn) return;
    try {
      const list = await loadOwnPosts({ podUrl, session });
      setPosts(list);
    } catch (err) {
      console.error('Reload posts failed:', err);
      showToast('Could not refresh posts', 'error');
    }
  }, [podUrl, session, showToast]);

  // ── Compose handler ───────────────────────────────────────
  const handleCompose = useCallback(
    async ({ type, file, caption, title, body, makePublic }) => {
      if (!podUrl || !session) throw new Error('Not signed in');

      let postUrl;
      if (type === 'photo') {
        postUrl = await uploadPhoto({ podUrl, session, file, caption });
      } else {
        postUrl = await createTextPost({ podUrl, session, title, body });
      }

      let shareFailed = false;
      let shareMessage = '';
      if (makePublic) {
        const justCreated = {
          url: postUrl,
          type,
          caption: type === 'photo' ? caption : '',
          body: type === 'text' ? body : '',
          title: type === 'text' ? title : '',
          dateCreated: new Date().toISOString(),
        };
        try {
          await sharePost({
            post: justCreated,
            podUrl,
            ownerWebId: session.info.webId,
            session,
          });
        } catch (err) {
          shareFailed = true;
          shareMessage = err.message;
        }
      }

      const toast = postedToast({ makePublic, shareFailed, shareMessage });
      showToast(toast.message, toast.type);
      await reloadPosts();
    },
    [podUrl, session, reloadPosts, showToast],
  );

  // ── Toggle public / private ───────────────────────────────
  const handleTogglePublic = useCallback(
    async (post) => {
      if (!podUrl || !session) return;
      setTogglingUrls((s) => new Set(s).add(post.url));

      // Optimistic update.
      setPosts((prev) =>
        prev.map((p) => (p.url === post.url ? { ...p, isPublic: !p.isPublic } : p)),
      );

      try {
        if (post.isPublic) {
          await unsharePost({
            post,
            podUrl,
            ownerWebId: session.info.webId,
            session,
          });
          showToast('Made private');
        } else {
          await sharePost({
            post,
            podUrl,
            ownerWebId: session.info.webId,
            session,
          });
          showToast('Now public — friends can see it');
        }
      } catch (err) {
        showToast(`Could not change visibility: ${err.message}`, 'error');
        await reloadPosts();
      } finally {
        setTogglingUrls((s) => {
          const n = new Set(s);
          n.delete(post.url);
          return n;
        });
      }
    },
    [podUrl, session, showToast, reloadPosts],
  );

  // ── Edit ──────────────────────────────────────────────────
  const handleEdit = useCallback(
    async (post, changes) => {
      if (!session) return;
      try {
        if (post.type === 'photo') {
          await editPhotoCaption({
            post,
            newCaption: changes.caption || '',
            podUrl,
            ownerWebId: session.info.webId,
            session,
          });
        } else {
          await editTextPost({
            post,
            newTitle: changes.title || '',
            newBody: changes.body || '',
            podUrl,
            ownerWebId: session.info.webId,
            session,
          });
        }
        showToast('Saved');
        await reloadPosts();
      } catch (err) {
        showToast(`Edit failed: ${err.message}`, 'error');
        throw err;
      }
    },
    [podUrl, session, reloadPosts, showToast],
  );

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (post) => {
      if (!podUrl || !session) return;
      setDeletingUrls((s) => new Set(s).add(post.url));

      // Optimistic remove.
      setPosts((prev) => prev.filter((p) => p.url !== post.url));

      try {
        await deletePost({ post, podUrl, session });
        showToast('Deleted');
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
        await reloadPosts(); // Restore from server.
      } finally {
        setDeletingUrls((s) => {
          const n = new Set(s);
          n.delete(post.url);
          return n;
        });
      }
    },
    [podUrl, session, reloadPosts, showToast],
  );

  // ── Friends ───────────────────────────────────────────────
  const handleAddFriend = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      setAddingWebId(webId);
      try {
        const profile = await addFriend({ podUrl, session, webId });
        setFriends((prev) => {
          if (prev.some((f) => f.webId === profile.webId)) return prev;
          return [...prev, profile];
        });
        showToast(`Now following ${profile.name || 'user'}`);
      } catch (err) {
        showToast(`Could not follow: ${err.message}`, 'error');
      } finally {
        setAddingWebId(null);
      }
    },
    [podUrl, session, showToast],
  );

  const handleRemoveFriend = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      // Optimistic.
      const prev = friends;
      setFriends((f) => f.filter((x) => x.webId !== webId));
      try {
        await removeFriend({ podUrl, session, webId });
        showToast('Unfollowed');
      } catch (err) {
        setFriends(prev);
        showToast(`Could not unfollow: ${err.message}`, 'error');
      }
    },
    [podUrl, session, friends, showToast],
  );

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    sessionGenRef.current++;
    await logout();
    setSession(null);
    setPodUrl(null);
    setProfile({ name: '', bio: '', avatarUrl: '' });
    setPosts([]);
    setFriends([]);
    setOnboardingOpen(false);
    navigate('/');
  }, [navigate]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    if (!session?.info?.isLoggedIn) return;
    const onKey = (e) => {
      // Ignore when typing in inputs/textareas/contenteditables.
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'h' || e.key === 'f') navigate('/');
      else if (e.key === 'd') navigate('/discover');
      else if (e.key === 'p') navigate('/profile');
      else if (e.key === 'n') setComposerOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, navigate]);

  const finishOnboarding = useCallback(() => {
    if (session?.info?.webId) markOnboardingDone(window.localStorage, session.info.webId);
    setOnboardingOpen(false);
  }, [session]);

  const handleSaveName = useCallback(
    async (name) => {
      await saveProfile({
        podUrl,
        session,
        ownerWebId: session.info.webId,
        profile: { name, bio: profile.bio || '', avatarUrl: profile.avatarUrl || '' },
      });
      setProfile((prev) => ({ ...prev, name }));
    },
    [podUrl, session, profile],
  );

  // ── Render ────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-300 text-sm">Resuming session…</p>
        </div>
      </div>
    );
  }

  if (!session?.info?.isLoggedIn) {
    return (
      <>
        <LoginPage error={authError} />
        {toast && (
          <Toast
            key={toast.key}
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen relative z-10">
      <Header
        session={session}
        profile={profile}
        podUrl={podUrl}
        onLogout={handleLogout}
        onCompose={() => setComposerOpen(true)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
        {authError && (
          <div className="mb-6 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent" role="alert">
            {authError}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                friends={friends}
                session={session}
                ownPostCount={posts.length}
                onRemoveFriend={handleRemoveFriend}
                onCompose={() => setComposerOpen(true)}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/discover"
            element={
              <DiscoverPage
                session={session}
                friends={friends}
                onAddFriend={handleAddFriend}
                addingWebId={addingWebId}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                session={session}
                podUrl={podUrl}
                profile={profile}
                onProfileUpdated={(p) => setProfile(p)}
                posts={posts}
                loading={loadingPosts}
                friends={friends}
                onCompose={() => setComposerOpen(true)}
                onTogglePublic={handleTogglePublic}
                onEdit={handleEdit}
                onDelete={handleDelete}
                togglingUrls={togglingUrls}
                deletingUrls={deletingUrls}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/people"
            element={
              <PersonPage
                session={session}
                friends={friends}
                onAddFriend={handleAddFriend}
                addingWebId={addingWebId}
              />
            }
          />
          <Route path="/post" element={<PostPage session={session} posts={posts} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav onCompose={() => setComposerOpen(true)} />

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCompose}
      />

      {onboardingOpen && podUrl && (
        <Onboarding
          webId={session.info.webId}
          initialName={profile.name || ''}
          onSaveName={handleSaveName}
          onCompose={() => setComposerOpen(true)}
          onDone={finishOnboarding}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
