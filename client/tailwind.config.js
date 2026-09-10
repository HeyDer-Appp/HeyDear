/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#16181d',
        slate: '#434c59',
        'dark-card': '#353d4a',
        'deep-card': '#131c2e',
        cream: '#F5EDD8',
        gold: '#E8A854',
        yellow: '#f0c040',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', 'Arial', 'sans-serif'],
        poppins: ['Poppins', 'Arial', 'sans-serif'],
        dmsans: ['"DM Sans"', 'Arial', 'sans-serif'],
      },
      animation: {
        'ticker': 'ticker 30s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
