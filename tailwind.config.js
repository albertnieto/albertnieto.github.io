/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '976px',
      xl: '1440px',
    },
    colors: {
      'transparent': 'transparent',
      'kimberly':'#626097',
      'careys-pink':'#D0A7BB',
      'cinder':'#100E1B',
      'logan':'#ABACD0',
      'black12':'#121212',
      'white12':'#ededed',
      'white':'#ffffff',
    },
    extend: {
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [require('tailwindcss-font-inter')],
}
