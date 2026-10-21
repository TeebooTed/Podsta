import { LOOKS, SHAPES } from '../lib/photoFilters.js';

/**
 * One tap picks a look. Square, 4:5, brightness and warmth sit beside it.
 * Nothing here is required: As shot and Original leave the photo unchanged.
 */
export default function PhotoLooks({ previewUrl, adjust, onChange, disabled = false }) {
  const brightness = Math.round((Number(adjust.brightness) || 0) * 100);
  const warmth = Math.round((Number(adjust.warmth) || 0) * 100);

  return (
    <div className="space-y-3">
      <div>
        <p id="composer-looks" className="text-xs font-extrabold uppercase tracking-wider text-ink-300 mb-2">
          Looks
        </p>
        <div
          role="group"
          aria-labelledby="composer-looks"
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {LOOKS.map((look) => {
            const selected = (adjust.filter || 'as-shot') === look.id;
            return (
              <button
                key={look.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onChange({ filter: look.id })}
                className={`shrink-0 w-16 rounded-2xl p-1 text-center transition disabled:opacity-50 ${
                  selected ? 'bg-ink-700 ring-2 ring-accent' : 'bg-ink-900 hover:bg-ink-800'
                }`}
              >
                <span className="block aspect-square rounded-xl overflow-hidden bg-ink-800">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      style={look.css ? { filter: look.css } : undefined}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="block w-full h-full bg-ink-700" />
                  )}
                </span>
                <span
                  className={`block text-[11px] leading-tight font-extrabold mt-1 truncate ${
                    selected ? 'text-ink-50' : 'text-ink-100'
                  }`}
                >
                  {look.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="group" aria-label="Crop shape" className="flex flex-wrap gap-2">
        {SHAPES.map((shape) => {
          const selected = (adjust.shape || 'original') === shape.id;
          return (
            <button
              key={shape.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange({ shape: shape.id })}
              className={`min-h-11 px-4 rounded-full text-sm font-extrabold border transition disabled:opacity-50 ${
                selected
                  ? 'bg-ink-700 text-ink-50 border-accent ring-2 ring-accent'
                  : 'bg-ink-800 text-ink-50 border-ink-600 hover:border-ink-400'
              }`}
            >
              {shape.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="composer-brightness" className="block text-xs font-extrabold text-ink-200">
          Brightness
          <span className="ml-2 font-bold tabular-nums text-ink-100">
            {brightness > 0 ? `+${brightness}` : brightness}
          </span>
          <input
            id="composer-brightness"
            type="range"
            min={-40}
            max={40}
            step={5}
            value={brightness}
            disabled={disabled}
            onChange={(event) => onChange({ brightness: Number(event.target.value) / 100 })}
            className="mt-1 block w-full accent-accent"
          />
        </label>
        <label htmlFor="composer-warmth" className="block text-xs font-extrabold text-ink-200">
          Warmth
          <span className="ml-2 font-bold text-ink-100">{warmthLabel(warmth)}</span>
          <input
            id="composer-warmth"
            type="range"
            min={-100}
            max={100}
            step={5}
            value={warmth}
            disabled={disabled}
            onChange={(event) => onChange({ warmth: Number(event.target.value) / 100 })}
            className="mt-1 block w-full accent-accent"
          />
        </label>
      </div>
    </div>
  );
}

function warmthLabel(warmth) {
  if (warmth <= -40) return 'Cool';
  if (warmth >= 40) return 'Warm';
  if (warmth === 0) return '0';
  return warmth > 0 ? `+${warmth}` : String(warmth);
}
