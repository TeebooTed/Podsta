const COLORS = ['bg-accent', 'bg-berry', 'bg-sunshine', 'bg-mint'];
const COUNT = 10;

/**
 * Confetti for a like: small brand-coloured dots that fly out of the heart and fade.
 * Decorative only. Hidden for reduced motion, where the filled heart says enough.
 * Re-key it to play again.
 */
export default function LikeBurst({ radius = 26, className = '' }) {
  return (
    <span
      className={`pointer-events-none absolute inset-0 grid place-items-center motion-reduce:hidden ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
        const reach = radius * (i % 3 === 0 ? 1.25 : 1);
        const size = (i % 3 === 0 ? 7 : 5) * (radius > 50 ? 1.6 : 1);
        return (
          <span
            key={i}
            className={`absolute rounded-full animate-like-particle ${COLORS[i % COLORS.length]}`}
            style={{
              width: size,
              height: size,
              '--dx': `${Math.round(Math.cos(angle) * reach)}px`,
              '--dy': `${Math.round(Math.sin(angle) * reach)}px`,
              animationDelay: `${(i % 4) * 18}ms`,
            }}
          />
        );
      })}
    </span>
  );
}
