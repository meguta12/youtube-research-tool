/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          500: '#1a73e8',
          600: '#155ec0',
          700: '#114a99'
        }
      },
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'Meiryo', 'sans-serif']
      }
    }
  },
  plugins: []
};
