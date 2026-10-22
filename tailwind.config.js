/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: {
          50: '#fff8f0',
          100: '#ffecd9',
          200: '#ffd6b3',
          300: '#ffb884',
          400: '#ff9152',
          500: '#f96f2b',
          600: '#e5511a',
          700: '#bf3914',
          800: '#992d19',
          900: '#7c2a19',
        },
        wine: {
          50: '#fdf4f5',
          100: '#fbe8ea',
          200: '#f6d4d8',
          300: '#efb3ba',
          400: '#e58592',
          500: '#dc5c6d',
          600: '#c53e53',
          700: '#a52f45',
          800: '#89293b',
          900: '#722735',
        },
        dusk: {
          50: '#f6f7fb',
          100: '#eceef6',
          200: '#d5d9e8',
          300: '#b1b9d2',
          400: '#8894b8',
          500: '#68759f',
          600: '#525d84',
          700: '#424b69',
          800: '#394055',
          900: '#33394a',
          950: '#22242e',
        },
        gold: {
          200: '#f7e7b4',
          300: '#f0d98c',
          400: '#e6c163',
          500: '#d9a441',
          600: '#c0852c',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        script: ['"Dancing Script"', 'cursive'],
        serif: ['Lora', 'Georgia', 'serif'],
        title: ['Cinzel', 'Georgia', 'serif'],
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 12s ease-in-out infinite',
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 4s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'breathe': 'breathe 5s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
        'orbit-slow': 'orbit 40s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-24px) rotate(3deg)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.2', transform: 'scale(0.9)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.06)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.02)', filter: 'brightness(1.08)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(var(--orbit-r)) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg)' },
        },
      },
      boxShadow: {
        'glow-ember': '0 0 40px -8px rgba(249, 111, 43, 0.55)',
        'glow-wine': '0 0 60px -12px rgba(197, 62, 83, 0.5)',
        'card-lift': '0 20px 50px -20px rgba(0,0,0,0.55)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}