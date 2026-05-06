/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Distinctive choices: a humanist serif for display, a clean sans for body, mono for IDs.
        // Loaded via index.html <link> tags.
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Custom palette — warm earthy with electric accent.
        ink: {
          50: '#faf8f5',
          100: '#f0ece4',
          200: '#dcd4c4',
          300: '#b8a98e',
          400: '#8a7a5e',
          500: '#5a4f3c',
          600: '#3d3429',
          700: '#2a2419',
          800: '#1a1610',
          900: '#0e0c08',
          950: '#070604',
        },
        accent: {
          DEFAULT: '#e85d3c',
          light: '#ff7a5c',
          dark: '#c04829',
        },
        signal: '#6ee7b7', // for "live" / public indicators
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        slideDown: { from: { transform: 'translateY(-10px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        pulseSoft: { '0%, 100%': { opacity: 0.6 }, '50%': { opacity: 1 } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
