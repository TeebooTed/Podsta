import { useState, useEffect } from 'react';
import Modal from './Modal.jsx';
import { MAX_TEXT_LENGTH, MAX_CAPTION_LENGTH } from '../lib/vocab.js';

/**
 * Modal for editing an existing post. Shape varies by post type:
 *   - photo: edit the caption only (the image itself is immutable)
 *   - text:  edit title and body
 */
export default function EditPostModal({ open, post, onClose, onSave, saving }) {
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!post) return;
    setCaption(post.caption || '');
    setTitle(post.title || '');
    setBody(post.body || '');
  }, [post]);

  if (!post) return null;

  const handleSave = () => {
    if (post.type === 'photo') {
      onSave({ caption });
    } else {
      onSave({ title, body });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit post">
      {post.type === 'photo' ? (
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
            className="input-field"
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              className="input-field display-serif text-lg"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-300 mb-1.5">
              Body
              <span className="text-ink-400 ml-2 font-normal">
                {body.length}/{MAX_TEXT_LENGTH}
              </span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_TEXT_LENGTH))}
              rows={8}
              className="input-field resize-y leading-relaxed"
            />
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-ink-700 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary" disabled={saving}>
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
