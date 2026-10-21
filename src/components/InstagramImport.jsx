import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { composerChoices, ceilingNote, DEFAULT_LEVEL } from '../lib/discoverability.js';
import { openFileList, scanInstagramExport } from '../lib/instagramExport.js';
import {
  browserImportTools,
  markAlreadyImported,
  readImportedSources,
  runInstagramImport,
  uploadPreparedInstagramPost,
} from '../lib/instagramImport.js';
import { openZip } from '../lib/zipArchive.js';

function formatWhen(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function postLabel(post) {
  const caption = post.caption || 'No caption';
  const when = formatWhen(post.createdAt);
  return `${when}. ${caption}`;
}

/**
 * Pick an Instagram JSON export, preview the posts, and save the chosen ones.
 * The dialog stays mounted so a stopped import can continue without re-reading
 * photos that already landed.
 */
export default function InstagramImport({
  session,
  podUrl,
  discoverability = DEFAULT_LEVEL,
  showToast,
  onImported,
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('choose');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [audience, setAudience] = useState('private');
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const fsRef = useRef(null);
  const stopRef = useRef(false);
  const readGeneration = useRef(0);
  const zipRef = useRef(null);
  const folderRef = useRef(null);
  const choices = composerChoices(discoverability);

  const resetInputs = () => {
    if (zipRef.current) zipRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
  };

  const readExport = async (fileList, kind) => {
    const generation = readGeneration.current + 1;
    readGeneration.current = generation;
    setError('');
    setSummary(null);
    setPhase('reading');
    setMessage(kind === 'zip' ? 'Reading the zip…' : 'Reading the folder…');
    stopRef.current = false;
    const current = () => generation === readGeneration.current;
    try {
      const fs = kind === 'zip' ? await openZip(fileList[0]) : openFileList(fileList);
      fsRef.current = fs;
      setMessage('Looking for posts…');
      const found = await scanInstagramExport(fs);
      if (!current()) return;
      if (!found.length) {
        fsRef.current = null;
        setPhase('choose');
        setError("No posts were found. Choose Instagram's JSON download, not the HTML one.");
        return;
      }
      setMessage('Checking your pod for posts already saved…');
      const known = await readImportedSources({
        podUrl,
        session,
        onProgress: (update) => {
          if (update.count) setMessage(`Checking your pod… ${update.index} of ${update.count}`);
        },
      });
      const { ledger } = browserImportTools();
      const marked = await markAlreadyImported(found, known, ledger, session?.info?.webId);
      if (!current()) return;
      setPosts(marked);
      setVisibleCount(40);
      setSelected(new Set(marked.filter((post) => post.importable && !post.alreadyImported).map((post) => post.key)));
      setPhase('preview');
      setMessage('');
    } catch (err) {
      if (!current()) return;
      fsRef.current = null;
      setPhase('choose');
      setError(err?.message || 'That export could not be read.');
    } finally {
      resetInputs();
    }
  };

  const toggle = (key) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectable = posts.filter((post) => post.importable && !post.alreadyImported);

  const startImport = async () => {
    if (!fsRef.current || !selected.size) return;
    setError('');
    setPhase('importing');
    stopRef.current = false;
    const tools = browserImportTools();
    try {
      const result = await runInstagramImport({
        posts,
        keys: selected,
        fs: fsRef.current,
        audience,
        level: discoverability,
        ledger: tools.ledger,
        webId: session?.info?.webId,
        prepareFile: tools.prepareFile,
        shouldStop: () => stopRef.current,
        onProgress: (update) => setProgress(update),
        uploadPost: (info) =>
          uploadPreparedInstagramPost({
            ...info,
            session,
            podUrl,
            ownerWebId: session?.info?.webId,
            onProgress: (update) => setProgress({ phase: 'upload', ...update, postRatio: update.ratio }),
          }),
      });
      setSummary(result);
      setPhase('done');
      const skipped = posts.filter((post) => post.alreadyImported).length + result.skipped;
      const sentence =
        result.shareFailed > 0
          ? `Saved ${result.saved} in your pod. Sharing didn't finish for ${result.shareFailed}, so those stay Only me for now.`
          : `Saved ${result.saved} ${result.saved === 1 ? 'post' : 'posts'} in your pod.`;
      showToast?.(skipped ? `${sentence} ${skipped} already there, left as they are.` : sentence);
      if (result.saved) await onImported?.();
    } catch (err) {
      setSummary(err.summary || null);
      setPhase('paused');
      setError(
        err?.message ||
          'Saving stopped. Posts already in your pod are safe. Continue when you are ready.',
      );
    }
  };

  const percent = Math.min(100, Math.round(((progress?.ratio || progress?.postRatio || 0) * 100)));
  const progressLabel =
    phase === 'importing'
      ? progress?.phase === 'upload'
        ? `Uploading photo ${(progress.index || 0) + 1} of ${progress.count || 1}`
        : `Saving post ${progress?.index || 1} of ${progress?.count || selected.size}`
      : 'Import progress';

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="instagram-import-heading">
      <h2 id="instagram-import-heading" className="display-serif text-2xl mb-2">
        Bring in Instagram posts
      </h2>
      <p className="text-sm text-ink-100 leading-relaxed mb-4">
        Choose the zip or folder from Instagram's download. It has to be the JSON format. Podsta reads it on this
        device, shows you the posts, and saves the ones you pick into your pod. Camera location is removed, the same
        way as a new photo. They start as Only me unless you choose otherwise.
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          if (phase === 'reading') setPhase('choose');
          setOpen(true);
        }}
      >
        {phase === 'paused' ? 'Continue import' : 'Choose an export'}
      </button>

      <Modal
        open={open}
        onClose={() => {
          stopRef.current = true;
          readGeneration.current += 1;
          setOpen(false);
        }}
        maxWidth="max-w-xl"
        title="Bring in Instagram posts"
      >
        <div className="px-6 py-5 space-y-4">
          {phase === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-100 leading-relaxed">
                Pick the zip Instagram sent you, or the unzipped folder. HTML downloads don't include the post file Podsta can read.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => zipRef.current?.click()}>
                  Choose a zip
                </button>
                <button type="button" className="btn-secondary" onClick={() => folderRef.current?.click()}>
                  Choose a folder
                </button>
              </div>
              <input
                ref={zipRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readExport(event.target.files, 'zip');
                }}
              />
              <input
                ref={folderRef}
                type="file"
                className="hidden"
                multiple
                webkitdirectory=""
                onChange={(event) => {
                  if (event.target.files?.length) readExport(event.target.files, 'folder');
                }}
              />
            </div>
          )}

          {phase === 'reading' && (
            <p className="text-sm text-ink-100" aria-live="polite">
              {message || 'Reading the export…'}
            </p>
          )}

          {(phase === 'preview' || phase === 'importing' || phase === 'paused' || phase === 'done') && (
            <div className="space-y-4">
              <fieldset disabled={phase === 'importing'}>
                <legend className="text-sm text-ink-100 mb-2">Who can see these posts</legend>
                <p className="text-xs text-ink-200 mb-2">Only me is the default. You can change it before saving.</p>
                <div className="flex flex-col gap-2">
                  {choices.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-start gap-2 text-sm min-h-8 ${option.enabled ? 'cursor-pointer' : 'opacity-60'}`}
                    >
                      <input
                        type="radio"
                        name="import-audience"
                        value={option.id}
                        checked={audience === option.id}
                        disabled={!option.enabled}
                        onChange={() => setAudience(option.id)}
                        className="mt-0.5 accent-accent shrink-0"
                      />
                      <span>
                        <span className="text-ink-100">{option.label}</span>
                        <span className="block text-ink-200 text-xs">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {ceilingNote(discoverability) && <p className="text-xs text-ink-200 mt-2">{ceilingNote(discoverability)}</p>}
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink-100">
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'} found · {selected.size} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={phase === 'importing'}
                    onClick={() => setSelected(new Set(selectable.map((post) => post.key)))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    disabled={phase === 'importing'}
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <ul className="max-h-72 overflow-y-auto space-y-2 pr-1" aria-label="Posts in this export">
                {posts.slice(0, visibleCount).map((post) => {
                  const disabled = !post.importable || post.alreadyImported || phase === 'importing';
                  return (
                    <li key={post.key} className="rounded-lg border border-ink-700 px-3 py-2">
                      <label className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          className="mt-1 accent-accent shrink-0"
                          checked={post.alreadyImported || selected.has(post.key)}
                          disabled={disabled}
                          onChange={() => toggle(post.key)}
                        />
                        <span className="min-w-0">
                          <span className="block text-ink-50 break-words">{postLabel(post)}</span>
                          <span className="block text-xs text-ink-200 mt-1">
                            {post.images.length
                              ? `${post.images.length} ${post.images.length === 1 ? 'photo' : 'photos'}`
                              : 'Note'}
                            {post.parts > 1 ? ` · part ${post.part} of ${post.parts}` : ''}
                            {post.missing ? ` · ${post.missing} missing from the export` : ''}
                            {post.videos ? ` · ${post.videos} ${post.videos === 1 ? 'video' : 'videos'} left out` : ''}
                            {post.shortened ? ' · caption shortened' : ''}
                            {post.archived ? ' · archived on Instagram' : ''}
                            {post.alreadyImported ? ' · already in your pod' : ''}
                            {!post.importable && !post.alreadyImported ? " · photos weren't in this export" : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {visibleCount < posts.length && (
                <button type="button" className="btn-secondary" onClick={() => setVisibleCount((count) => count + 40)}>
                  Show more posts
                </button>
              )}
            </div>
          )}

          {phase === 'importing' && (
            <div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={progressLabel}
                className="h-2 rounded-full bg-ink-800 overflow-hidden"
              >
                <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-ink-200 mt-2" aria-live="polite">
                {progressLabel}
                {progress?.caption ? ` · ${progress.caption}` : ''}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-accent-ink bg-accent/10 border border-accent/30 rounded-lg px-3 py-2" role="alert">
              {error}
              {phase === 'paused' ? ' Posts already saved are in your pod. Continue to finish the rest.' : ''}
            </p>
          )}

          {phase === 'done' && summary && (
            <p className="text-sm text-ink-100" role="status">
              Saved {summary.saved} {summary.saved === 1 ? 'post' : 'posts'} in your pod.
              {summary.shareFailed
                ? ` Sharing didn't finish for ${summary.shareFailed}, so those stay Only me for now.`
                : ''}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                stopRef.current = true;
                readGeneration.current += 1;
                setOpen(false);
              }}
            >
              Close
            </button>
            {(phase === 'preview' || phase === 'paused') && (
              <button type="button" className="btn-primary" disabled={!selected.size} onClick={startImport}>
                {phase === 'paused' ? 'Continue' : `Import ${selected.size || ''}`.trim()}
              </button>
            )}
            {phase === 'done' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPhase('choose');
                  setPosts([]);
                  setSelected(new Set());
                  setSummary(null);
                  fsRef.current = null;
                }}
              >
                Choose another export
              </button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
