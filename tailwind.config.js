/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f5',
          100: '#ffe0ea',
          300: '#ff8fb1',
          500: '#ff2e6e',
          600: '#e6155a',
          700: '#c00a49',
        },
        admin: {
          300: '#67e8f9',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        ink: {
          900: '#0d0b1a',
          800: '#161329',
          700: '#211c3b',
          600: '#2e2852',
          400: '#6b6496',
          200: '#bdb7e0',
        },
        charA: '#ef4444',
        charB: '#3b82f6',
        charC: '#22c55e',
        charD: '#eab308',
        unmapped: '#6b7280',
      },
      fontFamily: {
        display: ['"Trebuchet MS"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 18px rgba(255, 46, 110, 0.45)',
        'glow-sm': '0 0 10px rgba(255, 46, 110, 0.3)',
        'glow-cyan': '0 0 18px rgba(6, 182, 212, 0.35)',
        'card-glow': '0 0 40px rgba(255, 46, 110, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(255,46,110,0.6))' },
          '50%': { opacity: '0.75', filter: 'drop-shadow(0 0 20px rgba(255,46,110,0.9))' },
        },
      },
      animation: {
        pop: 'pop 0.4s ease-out',
        float: 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
