import { Link } from 'react-router-dom';
import { captionParts } from '../lib/hashtags.js';
import { tagPath } from '../lib/navigation.js';

/**
 * Caption or note text, with #tags as links.
 * The tag page only shows posts the viewer can already read.
 */
export default function CaptionText({ text, className = '' }) {
  const parts = captionParts(text);
  if (!parts.length) return null;
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === 'tag' ? (
          <Link key={`${part.tag}-${index}`} to={tagPath(part.tag)} className="text-accent hover:text-accent-light">
            {part.value}
          </Link>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}
