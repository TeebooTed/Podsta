/**
 * Shown on Home after an invite link follows someone and sends a contact request.
 */
export default function InviteBanner({ message, onUndo, undoing = false }) {
  if (!message) return null;
  return (
    <section className="mb-6 card p-4 sm:p-5" aria-labelledby="invite-follow-heading">
      <h2 id="invite-follow-heading" className="sr-only">
        Invite
      </h2>
      <p className="text-sm text-ink-50 leading-relaxed">{message}</p>
      <div className="mt-3">
        <button type="button" className="btn-secondary" onClick={onUndo} disabled={undoing}>
          {undoing ? 'Undoing…' : 'Undo'}
        </button>
      </div>
    </section>
  );
}