/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'iqoo': '#F2A900',
        'dark': '#121212',
        'card': '#1E1E1E',
        'cyan-tech': '#00E5FF',
        'green-tech': '#00E676',
      }
    },
  },
  plugins: [],
}
