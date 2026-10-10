import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import { validatePhotoFile } from '../lib/posts.js';
import { isIdentityAdjust, renderAdjustedPhoto } from '../lib/photoAdjust.js';
import {
  MAX_TEXT_LENGTH,
  MAX_CAPTION_LENGTH,
  MAX_ALBUM_PHOTOS,
  ALLOWED_IMAGE_TYPES,
} from '../lib/vocab.js';
import { formatBytes } from '../lib/utils.js';
import { ceilingNote, composerChoices, DEFAULT_LEVEL } from '../lib/discoverability.js';

const blankAdjust = () => ({ rotation: 0, zoom: 1, panX: 0, panY: 0 });

/**
 * Photo and text composer.
 * Several photos become one post. Crop and rotate are buttons and a slider.
 * The progress bar counts bytes sent and stays short of full until the Pod answers.
 */
export default function Composer({ open, onClose, onSubmit, discoverability = DEFAULT_LEVEL }) {
  const [mode, setMode] = useState('photo');
  const [files, setFiles] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [selected, setSelected] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('private');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [uploaded, setUploaded] = useState([]);
  const [progress, setProgress] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setAdjustments([]);
      setSelected(0);
      setPreviewUrl(null);
      setCaption('');
      setTitle('');
      setBody('');
      setError(null);
      setSubmitting(false);
      setUploaded([]);
      setProgress(null);
      setDragOver(false);
      setAudience('private');
    }
  }, [open]);

  useEffect(() => {
    const allowed = composerChoices(discoverability).some((option) => option.id === audience && option.enabled);
    if (!allowed) setAudience('private');
  }, [discoverability, audience]);

  const current = files[selected] || null;
  const adjust = adjustments[selected] || blankAdjust();

  useEffect(() => {
    if (!current) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(current);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [current]);

  const addFiles = (incoming) => {
    const next = [...files];
    const nextAdjust = [...adjustments];
    const problems = [];
    for (const file of incoming) {
      if (next.length >= MAX_ALBUM_PHOTOS) {
        problems.push(`You can add ${MAX_ALBUM_PHOTOS} photos.`);
        break;
      }
      const problem = validatePhotoFile(file);
      if (problem) {
        problems.push(`${file.name}: ${problem}`);
        continue;
      }
      next.push(file);
      nextAdjust.push(blankAdjust());
    }
    setFiles(next);
    setAdjustments(nextAdjust);
    if (!files.length && next.length) setSelected(0);
    setError(problems.length ? problems[0] : null);
  };

  const updateAdjust = (patch) => {
    setAdjustments((previous) => previous.map((item, index) => (index === selected ? { ...item, ...patch } : item)));
  };

  const removeSelected = () => {
    const next = files.filter((_, index) => index !== selected);
    const nextAdjust = adjustments.filter((_, index) => index !== selected);
    setFiles(next);
    setAdjustments(nextAdjust);
    setSelected(Math.max(0, selected - 1));
    setUploaded([]);
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'photo' && !files.length) {
      setError('Please choose a photo');
      return;
    }
    if (mode === 'text' && !body.trim()) {
      setError('Text posts need a body');
      return;
    }

    setSubmitting(true);
    try {
      let prepared = files;
      if (mode === 'photo') {
        prepared = files.slice();
        for (let index = uploaded.length; index < files.length; index += 1) {
          const baked = await renderAdjustedPhoto(files[index], adjustments[index]);
          const problem = validatePhotoFile(baked);
          if (problem) throw new Error(problem);
          prepared[index] = baked;
        }
      }
      await onSubmit({
        type: mode,
        file: prepared[0] || null,
        files: prepared,
        caption: caption.trim(),
        title: title.trim(),
        body: body.trim(),
        audience,
        alreadyUploaded: uploaded,
        onProgress: (update) => setProgress(update),
      });
      onClose();
    } catch (err) {
      if (Array.isArray(err.uploaded)) setUploaded(err.uploaded);
      setError(err.message || 'Something went wrong');
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    if (mode !== 'photo' || submitting) return;
    addFiles([...(event.dataTransfer.files || [])]);
  };

  const percent = Math.round(((progress?.ratio || 0) * 100));
  const progressLabel = progress
    ? progress.phase === 'save'
      ? 'Saving the post'
      : `Uploading photo ${(progress.index || 0) + 1} of ${progress.count || files.length}`
    : 'Upload progress';

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl" title="New post">
      <div className="flex gap-1 mb-5 p-1 bg-ink-900 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            mode === 'photo' ? 'bg-ink-700 text-ink-50 shadow-sm' : 'text-ink-200'
          }`}
        >
          Photo
        </button>
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            mode === 'text' ? 'bg-ink-700 text-ink-50 shadow-sm' : 'text-ink-200'
          }`}
        >
          Text
        </button>
      </div>

      {mode === 'photo' && (
        <div
          className="space-y-4"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {!files.length ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
                dragOver ? 'border-accent bg-accent/10' : 'border-ink-600 hover:border-ink-400 bg-ink-900/50'
              }`}
            >
              <p className="text-ink-100 font-medium">Drop photos or click to choose</p>
              <p className="text-xs text-ink-200">JPEG, PNG, GIF, or WebP. Up to {MAX_ALBUM_PHOTOS} photos, 10 MB each.</p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className={`relative rounded-xl overflow-hidden bg-ink-900 max-h-96 ${dragOver ? 'ring-2 ring-accent' : ''}`}>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt=""
                    style={{
                      transform: `rotate(${adjust.rotation}deg) scale(${adjust.zoom}) translate(${adjust.panX * 12}%, ${adjust.panY * 12}%)`,
                    }}
                    className="w-full max-h-96 object-contain"
                  />
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {files.map((file, index) => (
                  <button
                    key={`${file.name}-${index}`}
                    type="button"
                    onClick={() => setSelected(index)}
                    className={`shrink-0 min-h-11 px-3 rounded-lg text-sm ${
                      index === selected ? 'bg-ink-700 text-ink-50' : 'bg-ink-900 text-ink-200'
                    }`}
                    aria-pressed={index === selected}
                  >
                    {index + 1}. {file.name}
                  </button>
                ))}
                {files.length < MAX_ALBUM_PHOTOS && (
                  <button type="button" className="shrink-0 btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    Add
                  </button>
                )}
              </div>
              <p className="text-xs text-ink-200 break-words min-w-0">
                {current?.name} · {current ? formatBytes(current.size) : ''}
                {uploaded.length ? ` · ${uploaded.length} already sent` : ''}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Crop and rotate">
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ rotation: adjust.rotation - 90 })}>
                  Rotate left
                </button>
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ rotation: adjust.rotation + 90 })}>
                  Rotate right
                </button>
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ panX: Math.max(-1, adjust.panX - 0.15) })}>
                  Nudge left
                </button>
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ panX: Math.min(1, adjust.panX + 0.15) })}>
                  Nudge right
                </button>
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ panY: Math.max(-1, adjust.panY - 0.15) })}>
                  Nudge up
                </button>
                <button type="button" className="btn-secondary" onClick={() => updateAdjust({ panY: Math.min(1, adjust.panY + 0.15) })}>
                  Nudge down
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => updateAdjust(blankAdjust())}
                  disabled={isIdentityAdjust(adjust)}
                >
                  Reset framing
                </button>
                <button type="button" className="btn-secondary" onClick={removeSelected}>
                  Remove
                </button>
              </div>
              <label htmlFor="composer-zoom" className="block text-xs font-medium text-ink-200">
                Zoom {adjust.zoom.toFixed(1)}×
                <input
                  id="composer-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={adjust.zoom}
                  onChange={(event) => updateAdjust({ zoom: Number(event.target.value) })}
                  className="mt-1 block w-full accent-accent"
                />
              </label>
              <p className="text-xs text-ink-200">Rotate and zoom are saved as a JPEG when you post. GIF motion is kept only if you leave the framing alone.</p>

              <div>
                <label htmlFor="composer-caption" className="block text-xs font-medium text-ink-200 mb-1.5">
                  Caption
                  <span className="text-ink-200 ml-2 font-normal">
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </span>
                </label>
                <input
                  id="composer-caption"
                  type="text"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH))}
                  placeholder="Add a caption (optional)"
                  className="input-field"
                />
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            multiple
            onChange={(event) => {
              addFiles([...(event.target.files || [])]);
              event.target.value = '';
            }}
            className="sr-only"
          />
        </div>
      )}

      {mode === 'text' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="composer-title" className="block text-xs font-medium text-ink-200 mb-1.5">
              Title (optional)
            </label>
            <input
              id="composer-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 200))}
              placeholder="A title for your post"
              className="input-field display-serif text-lg"
            />
          </div>
          <div>
            <label htmlFor="composer-body" className="block text-xs font-medium text-ink-200 mb-1.5">
              What's on your mind?
              <span className="text-ink-200 ml-2 font-normal">
                {body.length}/{MAX_TEXT_LENGTH}
              </span>
            </label>
            <textarea
              id="composer-body"
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, MAX_TEXT_LENGTH))}
              placeholder="Write something worth reading…"
              rows={8}
              className="input-field resize-y leading-relaxed"
            />
          </div>
        </div>
      )}

      {submitting && progress && (
        <div className="mt-4">
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
            {progressLabel}, {percent}%
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-ink-700 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <fieldset className="min-w-0">
          <legend className="text-sm text-ink-100 mb-2">Who can see this post</legend>
          <div className="flex flex-col gap-2">
            {composerChoices(discoverability).map((option) => (
              <label
                key={option.id}
                className={`flex items-start gap-2 text-sm min-h-8 ${option.enabled ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
              >
                <input
                  type="radio"
                  name="post-audience"
                  value={option.id}
                  checked={audience === option.id}
                  disabled={!option.enabled || submitting}
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
        <div className="flex gap-2 justify-end shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : error ? 'Retry' : 'Post'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
