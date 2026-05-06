import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import { validatePhotoFile } from '../lib/posts.js';
import {
  MAX_TEXT_LENGTH,
  MAX_CAPTION_LENGTH,
  ALLOWED_IMAGE_TYPES,
} from '../lib/vocab.js';
import { formatBytes } from '../lib/utils.js';

/**
 * Unified composer for both photo and text posts.
 *
 * UX:
 *  - Two tabs: "Photo" (file upload + caption) and "Text" (title + body).
 *  - On submit, calls `onSubmit({ type, file, caption, title, body, makePublic })`.
 *  - "Make this public" checkbox controls whether we share immediately.
 *  - Drag and drop is supported for the photo tab.
 */
export default function Composer({ open, onClose, onSubmit, defaultMakePublic = false }) {
  const [mode, setMode] = useState('photo'); // 'photo' | 'text'
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [makePublic, setMakePublic] = useState(defaultMakePublic);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Reset all state on close.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setTitle('');
      setBody('');
      setError(null);
      setSubmitting(false);
      setDragOver(false);
    }
  }, [open]);

  // Manage object URL lifecycle.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (f) => {
    if (!f) return;
    const err = validatePhotoFile(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'photo' && !file) {
      setError('Please choose a photo');
      return;
    }
    if (mode === 'text' && !body.trim()) {
      setError('Text posts need a body');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type: mode,
        file,
        caption: caption.trim(),
        title: title.trim(),
        body: body.trim(),
        makePublic,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (mode !== 'photo') return;
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl" title="New post">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-5 p-1 bg-ink-900 rounded-lg">
        <button
          onClick={() => setMode('photo')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            mode === 'photo' ? 'bg-ink-700 text-ink-50 shadow-sm' : 'text-ink-300'
          }`}
        >
          Photo
        </button>
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            mode === 'text' ? 'bg-ink-700 text-ink-50 shadow-sm' : 'text-ink-300'
          }`}
        >
          Text
        </button>
      </div>

      {/* Photo mode */}
      {mode === 'photo' && (
        <div className="space-y-4">
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`w-full aspect-video rounded-xl border-2 border-dashed
                          flex flex-col items-center justify-center gap-2
                          transition-colors
                          ${
                            dragOver
                              ? 'border-accent bg-accent/10'
                              : 'border-ink-600 hover:border-ink-400 bg-ink-900/50'
                          }`}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ink-400"
              >
                <path d="M3 16l4-4a3 3 0 014 0l5 5M14 14l1-1a3 3 0 014 0l3 3M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                <circle cx="9" cy="9" r="2" />
              </svg>
              <p className="text-ink-200 font-medium">Drop a photo or click to choose</p>
              <p className="text-xs text-ink-400">JPEG, PNG, GIF, WebP — up to 10 MB</p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-ink-900 max-h-96">
                <img
                  src={previewUrl}
                  alt="preview"
                  className="w-full max-h-96 object-contain"
                />
                <button
                  onClick={() => setFile(null)}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-ink-950/80 backdrop-blur-sm rounded-lg text-xs hover:bg-ink-950"
                >
                  Replace
                </button>
              </div>
              <p className="text-xs text-ink-400">
                {file.name} · {formatBytes(file.size)}
              </p>

              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  Caption
                  <span className="text-ink-400 ml-2 font-normal">
                    {caption.length}/{MAX_CAPTION_LENGTH}
                  </span>
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
                  placeholder="Add a caption (optional)"
                  className="input-field"
                  autoFocus
                />
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      )}

      {/* Text mode */}
      {mode === 'text' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1.5">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder="A title for your post"
              className="input-field display-serif text-lg"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1.5">
              What's on your mind?
              <span className="text-ink-400 ml-2 font-normal">
                {body.length}/{MAX_TEXT_LENGTH}
              </span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_TEXT_LENGTH))}
              placeholder="Write something worth reading…"
              rows={8}
              className="input-field resize-y leading-relaxed"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Footer: visibility toggle + submit */}
      <div className="mt-5 pt-4 border-t border-ink-700 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={makePublic}
            onChange={(e) => setMakePublic(e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-ink-200">Share publicly</span>
          <span className="text-ink-400 text-xs">
            ({makePublic ? 'visible to everyone' : 'private to you'})
          </span>
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
