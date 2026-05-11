/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: {
          50: '#fdf8ec',
          100: '#faefd0',
          200: '#f5dea1',
          300: '#EDE5D8',
          400: '#D4AF37',
          500: '#C4A028',
          600: '#a88820',
          700: '#7a6218',
          800: '#4d3e0f',
          900: '#231c06',
        },
        warm: {
          50:  '#EFEBE4',
          100: '#E8E0D5',
          200: '#D4C9B8',
          300: '#C0AF9A',
          400: '#A89880',
          500: '#8B7355',
          600: '#6B5540',
          700: '#4A3A2C',
          800: '#2C2C2A',
          900: '#1A1A18',
        },
        copper: {
          400: '#C8804B',
          500: '#B86D38',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1A1A18, #534AB7)',
        'gradient-card': 'linear-gradient(135deg, #F5F0E8, #EFEBE4)',
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(212,175,55,0.3)',
        'card': '0 2px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
