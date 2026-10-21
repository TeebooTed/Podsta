/**
 * In-app opt-in. The browser permission dialog stays closed until Turn on.
 */
export default function DeviceNoticePrompt({ onEnable, onDismiss }) {
  return (
    <section className="mb-6 card p-4 sm:p-5" aria-labelledby="device-notices-heading">
      <h2 id="device-notices-heading" className="display-serif text-2xl">
        Notes on this device
      </h2>
      <p className="text-sm text-ink-100 mt-2 leading-relaxed">
        Podsta can tell you when someone comments, likes a post, or asks to be a contact. It checks
        while Podsta is open, including after you install it. There is no extra server.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onEnable}>
          Turn on notifications
        </button>
        <button type="button" className="btn-ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
