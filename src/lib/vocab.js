// ─────────────────────────────────────────────────────────────
// RDF Vocabulary
// We use schema.org for content metadata (caption, body, dateCreated, author),
// FOAF for social graph (knows), and the Solid ACL vocabulary for permissions.
// ─────────────────────────────────────────────────────────────

export const SCHEMA = {
  caption: 'http://schema.org/caption',
  text: 'http://schema.org/text',
  body: 'http://schema.org/articleBody',
  dateCreated: 'http://schema.org/dateCreated',
  author: 'http://schema.org/author',
  image: 'http://schema.org/image',
  name: 'http://schema.org/name',
  description: 'http://schema.org/description',
  url: 'http://schema.org/url',
  about: 'http://schema.org/about',
};

export const FOAF = {
  knows: 'http://xmlns.com/foaf/0.1/knows',
  name: 'http://xmlns.com/foaf/0.1/name',
  Agent: 'http://xmlns.com/foaf/0.1/Agent',
};

export const VCARD = {
  Group: 'http://www.w3.org/2006/vcard/ns#Group',
  hasMember: 'http://www.w3.org/2006/vcard/ns#hasMember',
};

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

// Custom Podsta vocab (ad-hoc namespace; we just need stable IRIs for our own data).
export const PODSTA = {
  PostType: 'https://podsta.app/vocab#PostType', // "photo" | "text"
  Like: 'https://podsta.app/vocab#Like',
  PublicIndex: 'https://podsta.app/vocab#PublicIndex',
  audience: 'https://podsta.app/vocab#audience', // "public" | "contacts" | "private"
  discoverability: 'https://podsta.app/vocab#discoverability', // "public" | "contacts" | "hidden"
  ContactRequest: 'https://podsta.app/vocab#ContactRequest',
  ContactApproval: 'https://podsta.app/vocab#ContactApproval',
};

// Pod paths — relative to the user's pod URL.
export const PATHS = {
  photos: 'podsta/photos/',
  posts: 'podsta/posts/',
  comments: 'podsta/comments/',
  likes: 'podsta/likes.ttl',
  likeSets: 'podsta/like-sets/',
  contacts: 'podsta/contacts/friends.ttl',
  contactsGroup: 'podsta/contacts/group.ttl',
  publicIndex: 'podsta/public-index.ttl',
  contactsIndex: 'podsta/contacts-index.ttl',
  listing: 'podsta/listing.ttl',
  favorites: 'podsta/favorites.ttl',
  profile: 'podsta/profile.ttl',
  inbox: 'podsta/inbox/',
  contactRequests: 'podsta/contact-requests.ttl',
};

// Limits
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ALBUM_PHOTOS = 10;
export const MAX_TEXT_LENGTH = 5000;
export const MAX_CAPTION_LENGTH = 280;
export const MAX_COMMENT_LENGTH = 500;
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
