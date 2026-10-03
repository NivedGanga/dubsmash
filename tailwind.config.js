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
      keyframes: {
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: { pop: 'pop 0.4s ease-out' },
    },
  },
  plugins: [],
};
