import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { restoreSession, logout, findPodUrl, login, onSessionExpired } from './lib/auth.js';
import { describePodFailure } from './lib/errors.js';
import { readSnapshot, snapshotKey, writeSnapshot } from './lib/offlineStore.js';
import { lockExistingComments } from './lib/acl.js';
import { postedToast } from './lib/shareFeedback.js';
import { deliverPost, OFFLINE_COPY, QUEUED_COPY } from './lib/outbox.js';
import {
  loadOwnPosts,
  setPostAudience,
  editPhotoCaption,
  editTextPost,
  deletePost,
} from './lib/posts.js';
import { loadFriends, addFriend, removeFriend } from './lib/friends.js';
import { loadProfile, saveProfile } from './lib/profile.js';
import { applyDiscoverability } from './lib/applyDiscoverability.js';
import { loadContactMembers, saveContactMembers } from './lib/contactsGroup.js';
import { sendApprovalNotice, sendContactRequest } from './lib/contactRequest.js';
import { hasFinishedOnboarding, markOnboardingDone } from './lib/onboarding.js';
import {
  consumeFollow,
  consumeSignup,
  inviteUrl,
  rememberFollow,
  rememberSignup,
  SIGNUP_KEY,
} from './lib/invite.js';
import { appUrl, currentAppRoot } from './lib/appUrl.js';
import { displayHandle } from './lib/handles.js';
import { retryTransient } from './lib/timeoutFetch.js';
import { RECOMMENDED_PROVIDER } from './lib/provider.js';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import PersonPage from './pages/PersonPage.jsx';
import PostPage from './pages/PostPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import Header from './components/Header.jsx';
import BottomNav from './components/BottomNav.jsx';
import Onboarding from './components/Onboarding.jsx';
import Composer from './components/Composer.jsx';
import Modal from './components/Modal.jsx';
import Toast from './components/Toast.jsx';
import { useNotificationFeed } from './hooks/useNotificationFeed.js';
import { useOutbox } from './hooks/useOutbox.js';
import OutboxBanner from './components/OutboxBanner.jsx';
import { useTheme } from './hooks/useTheme.js';
import Logo from './components/Logo.jsx';

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
  const [libraryWarning, setLibraryWarning] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── App state (only meaningful when logged in) ────────────
  const [profile, setProfile] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    discoverability: 'hidden',
    discoverabilityInferred: true,
  });
  const [posts, setPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactBusy, setContactBusy] = useState(false);
  const [askWebId, setAskWebId] = useState('');
  const [sentRequests, setSentRequests] = useState([]);
  const [approvingWebId, setApprovingWebId] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [welcomeWebId, setWelcomeWebId] = useState('');
  const navigate = useNavigate();
  const followedPending = useRef(false);
  const theme = useTheme();

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
    let stopExpired = () => {};
    (async () => {
      try {
        const s = await restoreSession();
        stopExpired = onSessionExpired(() => {
          if (!cancelled) setSessionExpired(true);
        });
        if (cancelled) return;
        setSession(s);

        if (s?.info?.isLoggedIn) {
          const gen = ++sessionGenRef.current;
          const pod = await findPodUrl(s);
          if (cancelled || gen !== sessionGenRef.current) return;
          setPodUrl(pod);

          if (!pod) {
            setAuthError(
              "We couldn't find a pod at your address. Your profile needs to list where your pod's storage is (pim:storage).",
            );
          } else {
            // Load profile, posts, friends in parallel.
            setLoadingPosts(true);
            const [prof, postsList, friendsList, contactList] = await Promise.all([
              loadProfile({ podUrl: pod, session: s }).catch(() => ({
                name: '',
                bio: '',
                avatarUrl: '',
                discoverability: 'hidden',
                discoverabilityInferred: true,
              })),
              retryTransient(() => loadOwnPosts({ podUrl: pod, session: s }), {
                attempts: 4,
                wait: (attempt) => new Promise((resolve) => setTimeout(resolve, 4000 * attempt)),
              }).catch(async (err) => {
                console.error('Posts load failed:', err);
                const cached = await readSnapshot(snapshotKey('posts', s.info.webId)).catch(
                  () => null,
                );
                if (cached?.posts?.length) {
                  setLibraryWarning(describePodFailure(err));
                  return cached.posts;
                }
                setLibraryWarning(describePodFailure(err));
                return [];
              }),
              loadFriends({ podUrl: pod, session: s }).catch(() => []),
              loadContactMembers({ podUrl: pod, session: s }).catch(() => []),
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
            writeSnapshot(snapshotKey('posts', s.info.webId), { posts: postsList }).catch(() => {});
            setFriends(friendsList);
            setContacts(contactList);
            setLibraryReady(true);
            setLoadingPosts(false);
            if (consumeSignup(window.sessionStorage)) {
              setWelcomeWebId(s.info.webId);
            } else if (!hasFinishedOnboarding(window.localStorage, s.info.webId)) {
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
      stopExpired();
    };
  }, [showToast]);

  // ── Reload posts (called after compose, edit, delete) ─────
  const reloadPosts = useCallback(async () => {
    if (!podUrl || !session?.info?.isLoggedIn) return;
    try {
      const list = await loadOwnPosts({ podUrl, session });
      setPosts(list);
      setLibraryWarning('');
      writeSnapshot(snapshotKey('posts', session.info.webId), { posts: list }).catch(() => {});
    } catch (err) {
      console.error('Reload posts failed:', err);
      const cached = await readSnapshot(snapshotKey('posts', session.info.webId)).catch(() => null);
      if (cached?.posts?.length) setPosts(cached.posts);
      setLibraryWarning(describePodFailure(err));
    }
  }, [podUrl, session]);

  // ── Compose handler ───────────────────────────────────────
  const outbox = useOutbox({
    enabled: Boolean(session?.info?.isLoggedIn && podUrl),
    session,
    podUrl,
    webId: session?.info?.webId || '',
    onSent: reloadPosts,
  });

  const handleCompose = useCallback(
    async (draft) => {
      if (!podUrl || !session) throw new Error('Not signed in');
      const result = await deliverPost({
        draft,
        session,
        podUrl,
        webId: session.info.webId,
      });
      if (result.queued) {
        showToast(result.offline ? OFFLINE_COPY : QUEUED_COPY, 'info');
        return;
      }
      const toast = postedToast({
        audience: draft.audience || 'private',
        makePublic: draft.audience === 'public',
        shareFailed: result.shareFailed,
        shareMessage: result.shareMessage,
      });
      showToast(toast.message, toast.type);
      await reloadPosts();
    },
    [podUrl, session, reloadPosts, showToast],
  );

  // ── Per-post audience. No success toast until the write returns. ──
  const handleSetAudience = useCallback(
    async (post, audience) => {
      if (!podUrl || !session) return;
      const current = post.audience || (post.isPublic ? 'public' : 'private');
      if (current === audience) return;
      setTogglingUrls((s) => new Set(s).add(post.url));
      try {
        await setPostAudience({
          post,
          audience,
          level: profile.discoverability,
          podUrl,
          ownerWebId: session.info.webId,
          session,
        });
        const message =
          audience === 'public'
            ? 'Now public'
            : audience === 'contacts'
              ? 'Shared with your contacts'
              : 'Now only you';
        showToast(message);
      } catch (err) {
        showToast(
          err?.code === 'above-ceiling'
            ? err.message
            : "We saved your post, but couldn't change who can see it. Try sharing again in a moment.",
          'error',
        );
        console.error('Visibility change failed:', err);
      } finally {
        await reloadPosts();
        setTogglingUrls((s) => {
          const n = new Set(s);
          n.delete(post.url);
          return n;
        });
      }
    },
    [podUrl, session, profile.discoverability, showToast, reloadPosts],
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
        const added = await addFriend({
          podUrl,
          session,
          webId,
          discoverability: profile.discoverability,
        });
        setFriends((prev) => {
          if (prev.some((f) => f.webId === added.webId)) return prev;
          return [...prev, added];
        });
        showToast(`Now following ${added.name || 'user'}`);
      } catch (err) {
        showToast(
          err?.code === 'not-an-address' || err?.code === 'self'
            ? err.message
            : "We couldn't follow that person. Check their address and try again.",
          'error',
        );
      } finally {
        setAddingWebId(null);
      }
    },
    [podUrl, session, profile.discoverability, showToast],
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
    setProfile({
      name: '',
      bio: '',
      avatarUrl: '',
      discoverability: 'hidden',
      discoverabilityInferred: true,
    });
    setPosts([]);
    setFriends([]);
    setContacts([]);
    setLibraryReady(false);
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

  useEffect(() => {
    if (!session?.info?.isLoggedIn || !podUrl || followedPending.current) return;
    const pending = consumeFollow(window.sessionStorage);
    if (!pending || pending === session.info.webId) return;
    followedPending.current = true;
    handleAddFriend(pending);
    navigate(`/people?webid=${encodeURIComponent(pending)}`);
  }, [session, podUrl, handleAddFriend, navigate]);

  const startLogin = useCallback((issuer, redirectUrl) => {
    window.sessionStorage.removeItem(SIGNUP_KEY);
    return login(issuer, redirectUrl);
  }, []);

  const startSignup = useCallback(() => {
    rememberSignup(window.sessionStorage);
    return login(RECOMMENDED_PROVIDER.issuer, appUrl('/start'));
  }, []);

  const finishOnboarding = useCallback(() => {
    if (session?.info?.webId) markOnboardingDone(window.localStorage, session.info.webId);
    setOnboardingOpen(false);
  }, [session]);

  const handleSaveDiscoverability = useCallback(
    async (level, draft) => {
      if (!podUrl || !session) throw new Error('Not signed in');
      const nextProfile = {
        name: draft?.name ?? profile.name ?? '',
        bio: draft?.bio ?? profile.bio ?? '',
        avatarUrl: draft?.avatarUrl ?? profile.avatarUrl ?? '',
      };
      try {
        await applyDiscoverability({
          podUrl,
          session,
          ownerWebId: session.info.webId,
          level,
          profile: nextProfile,
          posts,
        });
      } catch (err) {
        try {
          setProfile(await loadProfile({ podUrl, session }));
        } catch {
          // Keep the last profile we successfully loaded.
        }
        await reloadPosts();
        throw err;
      }
      setProfile(await loadProfile({ podUrl, session }));
      await reloadPosts();
    },
    [podUrl, session, profile, posts, reloadPosts],
  );

  const handleAddContact = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      setContactBusy(true);
      try {
        const next = [...new Set([...contacts, webId])];
        const saved = await saveContactMembers({ podUrl, session, webIds: next });
        setContacts(saved);
      } finally {
        setContactBusy(false);
      }
    },
    [podUrl, session, contacts],
  );

  const handleRemoveContact = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      setContactBusy(true);
      try {
        const saved = await saveContactMembers({
          podUrl,
          session,
          webIds: contacts.filter((id) => id !== webId),
        });
        setContacts(saved);
      } catch (err) {
        showToast(`Could not remove that contact: ${err.message}`, 'error');
      } finally {
        setContactBusy(false);
      }
    },
    [podUrl, session, contacts, showToast],
  );

  const handleAddFollowing = useCallback(async () => {
    if (!podUrl || !session) return;
    setContactBusy(true);
    try {
      const saved = await saveContactMembers({
        podUrl,
        session,
        webIds: [...contacts, ...friends.map((friend) => friend.webId)],
      });
      setContacts(saved);
      showToast(saved.length ? 'Added the people you follow' : 'You are not following anyone yet');
    } catch (err) {
      showToast(`Could not add the people you follow: ${err.message}`, 'error');
    } finally {
      setContactBusy(false);
    }
  }, [podUrl, session, contacts, friends, showToast]);

  const notifications = useNotificationFeed({
    enabled: Boolean(session?.info?.isLoggedIn && podUrl && libraryReady),
    session,
    podUrl,
    webId: session?.info?.webId || '',
    friends,
    posts,
  });

  const handleAskContact = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      setAskWebId(webId);
      try {
        const result = await sendContactRequest({ podUrl, session, targetWebId: webId });
        setSentRequests((prev) => [...prev, result.targetWebId]);
        if (result.inboxDelivered) {
          showToast('Contact request sent');
        } else {
          showToast(
            `Request saved on your pod. ${result.inboxError || 'They will see it if they follow you.'}`,
            'info',
          );
        }
      } catch (err) {
        showToast(`Could not send the request: ${err.message}`, 'error');
      } finally {
        setAskWebId('');
      }
    },
    [podUrl, session, showToast],
  );

  const handleApproveRequest = useCallback(
    async (webId) => {
      if (!podUrl || !session) return;
      setApprovingWebId(webId);
      try {
        const next = [...new Set([...contacts, webId])];
        const saved = await saveContactMembers({ podUrl, session, webIds: next });
        setContacts(saved);
        const notice = await sendApprovalNotice({ session, targetWebId: webId });
        if (notice.delivered) showToast('Approved. They have been notified.');
        else {
          showToast(
            `Approved on your pod. ${notice.error || 'Their inbox did not accept the notice.'}`,
            'info',
          );
        }
      } catch (err) {
        showToast(`Could not approve: ${err.message}`, 'error');
      } finally {
        setApprovingWebId('');
      }
    },
    [podUrl, session, contacts, showToast],
  );

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
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <Logo size="lg" showWord={false} className="animate-float mb-4" />
          <p className="text-ink-300 text-sm font-bold">Opening your pod…</p>
        </div>
      </div>
    );
  }

  if (!session?.info?.isLoggedIn) {
    return (
      <>
        <Routes>
          <Route
            path="/start"
            element={<SignupPage onBegin={startSignup} error={authError || ''} />}
          />
          <Route
            path="/invite"
            element={
              <div className="min-h-screen px-4 pt-6 pb-16">
                <div className="max-w-3xl mx-auto">
                  <p className="mb-6">
                    <Link to="/" aria-label="Podsta home" className="inline-block rounded-xl">
                      <Logo size="md" />
                    </Link>
                  </p>
                  <PersonPage
                    session={null}
                    friends={[]}
                    signedIn={false}
                    addingWebId={null}
                    onAddFriend={async (webId) => {
                      try {
                        window.sessionStorage.removeItem(SIGNUP_KEY);
                        rememberFollow(window.sessionStorage, webId);
                        await login(
                          RECOMMENDED_PROVIDER.issuer,
                          inviteUrl(currentAppRoot(), webId),
                        );
                      } catch (err) {
                        showToast(err?.message || 'Could not open Solid Community.', 'error');
                      }
                    }}
                  />
                </div>
              </div>
            }
          />
          <Route
            path="/post"
            element={
              <div className="min-h-screen px-4 pt-6 pb-16">
                <div className="max-w-3xl mx-auto">
                  <p className="mb-6">
                    <Link to="/" aria-label="Podsta home" className="inline-block rounded-xl">
                      <Logo size="md" />
                    </Link>
                  </p>
                  <PostPage session={null} posts={[]} podUrl="" showToast={showToast} />
                </div>
              </div>
            }
          />
          <Route
            path="*"
            element={
              <LoginPage
                error={authError}
                onLogin={(issuer) => startLogin(issuer, appUrl('/'))}
                theme={theme}
              />
            }
          />
        </Routes>
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink-50 focus:text-ink-950 focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      <Header
        session={session}
        profile={profile}
        podUrl={podUrl}
        onLogout={handleLogout}
        onCompose={() => setComposerOpen(true)}
        unseenCount={notifications.unseenCount}
        theme={theme}
      />

      <main
        id="main"
        className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8"
      >
        {session?.info?.isLoggedIn && (
          <OutboxBanner
            items={outbox.items}
            offline={outbox.offline}
            flushing={outbox.flushing}
            onDiscard={outbox.discard}
          />
        )}
        {sessionExpired && (
          <div
            className="mb-6 px-4 py-3 bg-ink-800 border border-accent/40 rounded-lg text-sm text-ink-50 flex flex-wrap gap-3 items-center justify-between"
            role="alert"
          >
            <p>
              Your sign-in expired. Sign in again to continue. Posts saved on this device stay here.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => login(RECOMMENDED_PROVIDER.issuer, appUrl('/'))}
            >
              Sign in
            </button>
          </div>
        )}
        {libraryWarning && (
          <div
            className="mb-6 px-4 py-3 bg-ink-800 border border-ink-600 rounded-lg text-sm text-ink-50 flex flex-wrap gap-3 items-center justify-between"
            role="alert"
          >
            <p>{libraryWarning}</p>
            <button type="button" className="btn-secondary" onClick={() => reloadPosts()}>
              Try again
            </button>
          </div>
        )}
        {authError && (
          <div
            className="mb-6 px-4 py-3 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent-ink"
            role="alert"
          >
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
                podUrl={podUrl}
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
                onSetAudience={handleSetAudience}
                onSaveDiscoverability={handleSaveDiscoverability}
                contacts={contacts}
                onAddContact={handleAddContact}
                onRemoveContact={handleRemoveContact}
                onAddFollowing={handleAddFollowing}
                contactBusy={contactBusy}
                onEdit={handleEdit}
                onDelete={handleDelete}
                togglingUrls={togglingUrls}
                deletingUrls={deletingUrls}
                onRefresh={reloadPosts}
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
                onAskContact={handleAskContact}
                askWebId={askWebId}
                requestedWebIds={[...notifications.outgoingTargets, ...sentRequests]}
              />
            }
          />
          <Route
            path="/post"
            element={
              <PostPage session={session} posts={posts} podUrl={podUrl} showToast={showToast} />
            }
          />
          <Route
            path="/notifications"
            element={
              <NotificationsPage
                items={notifications.items}
                seen={notifications.seen}
                channelConnected={notifications.channelConnected}
                failing={notifications.failing}
                error={notifications.error}
                checking={notifications.checking}
                contacts={contacts}
                onAcknowledge={notifications.acknowledge}
                onRefresh={notifications.refresh}
                onApprove={handleApproveRequest}
                approvingWebId={approvingWebId}
              />
            }
          />
          <Route
            path="/invite"
            element={
              <PersonPage
                session={session}
                friends={friends}
                onAddFriend={handleAddFriend}
                addingWebId={addingWebId}
                onAskContact={handleAskContact}
                askWebId={askWebId}
                requestedWebIds={[...notifications.outgoingTargets, ...sentRequests]}
              />
            }
          />
          <Route path="/start" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav onCompose={() => setComposerOpen(true)} />

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCompose}
        discoverability={profile.discoverability || 'hidden'}
      />

      <Modal
        open={Boolean(welcomeWebId)}
        onClose={() => {
          const id = welcomeWebId;
          setWelcomeWebId('');
          if (id && !hasFinishedOnboarding(window.localStorage, id)) setOnboardingOpen(true);
        }}
        title="We found you"
      >
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-ink-100 leading-relaxed">
            Solid Community sent you back signed in. This is the address Podsta will use for you.
          </p>
          <p className="display-serif text-3xl">
            {displayHandle(welcomeWebId).qualified || welcomeWebId}
          </p>
          <code className="text-xs font-mono bg-ink-900 px-2 py-1 rounded break-all block">
            {welcomeWebId}
          </code>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const id = welcomeWebId;
              setWelcomeWebId('');
              if (id && !hasFinishedOnboarding(window.localStorage, id)) setOnboardingOpen(true);
            }}
          >
            Continue
          </button>
        </div>
      </Modal>

      {onboardingOpen && podUrl && !welcomeWebId && (
        <Onboarding
          webId={session.info.webId}
          initialName={profile.name || ''}
          initialLevel={profile.discoverability || 'hidden'}
          onSaveName={handleSaveName}
          onSaveDiscoverability={(level) => handleSaveDiscoverability(level)}
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
