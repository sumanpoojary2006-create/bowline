/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#07111f',
        accent: '#f59e0b',
        pine: '#1b4332',
        mist: '#d7e3fc',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"Manrope"', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 80px rgba(245, 158, 11, 0.18)',
      },
    },
  },
  plugins: [],
};
