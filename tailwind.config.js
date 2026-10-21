/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Brand type (brand/BRAND.md): Fredoka for headings, Nunito for text. Self-hosted, no font CDN.
        display: ['"Fredoka Variable"', '"Fredoka"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Nunito Variable"', '"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // `ink` is the theme scale: 950 is the page, 800 a raised surface, 50 the strongest text.
        // Light and dark values live in src/styles/index.css.
        ink: {
          50: token('ink-50'),
          100: token('ink-100'),
          200: token('ink-200'),
          300: token('ink-300'),
          400: token('ink-400'),
          500: token('ink-500'),
          600: token('ink-600'),
          700: token('ink-700'),
          800: token('ink-800'),
          900: token('ink-900'),
          950: token('ink-950'),
        },
        // Coral is a fill. Put Plum text on it. `accent-ink` is coral that passes AA as text.
        accent: {
          DEFAULT: '#FF6B57',
          light: '#FF8A73',
          dark: '#E8503C',
          ink: token('accent-ink'),
        },
        signal: token('signal'),
        berry: { DEFAULT: '#E8457A', ink: token('berry-ink') },
        sunshine: '#FFC547',
        mint: '#3DD9A8',
        plum: '#2B1B3D',
        cream: '#FFF7EE',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.08), 0 18px 40px -18px rgb(var(--shadow) / 0.35)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s ease-out',
        'pop-in': 'popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'heart-pop': 'heartPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'heart-burst': 'heartBurst 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'like-ring': 'likeRing 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'count-up': 'countUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-from-right': 'slideFromRight 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-from-left': 'slideFromLeft 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'spin-slow': 'spin 1.1s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          from: { transform: 'translateY(-8px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        popIn: {
          from: { transform: 'scale(0.85)', opacity: 0 },
          to: { transform: 'scale(1)', opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '100% 0' },
          '100%': { backgroundPosition: '-100% 0' },
        },
        pulseSoft: { '0%, 100%': { opacity: 0.6 }, '50%': { opacity: 1 } },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.35)' },
          '65%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        heartBurst: {
          '0%': { transform: 'scale(0.2)', opacity: 0 },
          '20%': { transform: 'scale(1.15)', opacity: 1 },
          '40%': { transform: 'scale(0.95)', opacity: 1 },
          '70%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(1.1) translateY(-12px)', opacity: 0 },
        },
        likeRing: {
          '0%': { transform: 'scale(0.3)', opacity: 0.9 },
          '100%': { transform: 'scale(1.9)', opacity: 0 },
        },
        countUp: {
          from: { transform: 'translateY(60%)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        slideFromRight: {
          from: { transform: 'translateX(12%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        slideFromLeft: {
          from: { transform: 'translateX(-12%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
