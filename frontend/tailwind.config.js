/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        zp: {
          bg:      '#0d1117',
          panel:   '#161b22',
          border:  '#30363d',
          accent:  '#58a6ff',
          pending: '#f6ad55',
          approve: '#48bb78',
          deny:    '#fc8181',
          defer:   '#f6e05e',
        },
      },
    },
  },
  plugins: [],
}
