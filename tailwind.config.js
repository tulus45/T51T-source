/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e9eeff',
          200: '#d1ddff',
          300: '#adc0ff',
          400: '#7b99ff',
          500: '#4f73ff',
          600: '#3253f5',
          700: '#2742db',
          800: '#2638b1',
          900: '#26338b',
        },
      },
      boxShadow: {
        soft: '0 24px 70px -36px rgba(15, 23, 42, 0.35)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
