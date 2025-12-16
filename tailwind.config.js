/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./admin/**/*.html",
    "./scripts/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Fidget Street Color Palette - Playful & Calming
        // Primary - Soft Blue (calming base)
        'soft-blue': {
          DEFAULT: '#71c7e1',
          50: '#f0f9fc',
          100: '#d9f0f7',
          200: '#b3e2ef',
          300: '#8dd4e7',
          400: '#71c7e1',
          500: '#55b9d9',
          600: '#399ac0',
          700: '#2d7b9a',
          800: '#235c73',
          900: '#1a3d4d',
        },
        // Mint Green - fresh accent
        'mint': {
          DEFAULT: '#A8E0A2',
          50: '#f4fbf3',
          100: '#e3f5e1',
          200: '#c7ebc3',
          300: '#A8E0A2',
          400: '#89d581',
          500: '#6aca60',
          600: '#4db040',
          700: '#3d8932',
          800: '#2d6625',
          900: '#1e4318',
        },
        // Lemon Yellow - playful pop
        'lemon': {
          DEFAULT: '#F9F92F',
          50: '#fefef5',
          100: '#fdfde1',
          200: '#fbfb98',
          300: '#F9F92F',
          400: '#e8e81e',
          500: '#d4d410',
          600: '#a8a80c',
          700: '#7c7c09',
          800: '#505006',
          900: '#282803',
        },
        // Lavender Purple - calming undertone
        'lavender': {
          DEFAULT: '#D8B4E2',
          50: '#faf6fc',
          100: '#f2e8f7',
          200: '#e5d1ef',
          300: '#D8B4E2',
          400: '#c997d5',
          500: '#ba7ac8',
          600: '#a55cb5',
          700: '#844794',
          800: '#633573',
          900: '#422352',
        },
        // Bright Coral - highlight warmth (replaces rose-gold as accent)
        'coral': {
          DEFAULT: '#FF6F61',
          50: '#fff5f4',
          100: '#ffe5e2',
          200: '#ffccc6',
          300: '#ffa99f',
          400: '#FF6F61',
          500: '#ff4d3d',
          600: '#ed3324',
          700: '#c7281c',
          800: '#a32318',
          900: '#872218',
        },
        // Keep rose-gold for compatibility (maps to coral)
        'rose-gold': {
          DEFAULT: '#FF6F61',
          50: '#fff5f4',
          100: '#ffe5e2',
          200: '#ffccc6',
          300: '#ffa99f',
          400: '#FF6F61',
          500: '#ff4d3d',
          600: '#ed3324',
          700: '#c7281c',
        },
        'pastel-pink': '#ffe5e2',
        'black': '#000000',
        'white': '#FFFFFF',
        // Navy becomes soft-blue based
        'navy': {
          DEFAULT: '#2d7b9a',
          50: '#f0f9fc',
          100: '#d9f0f7',
          200: '#b3e2ef',
          300: '#8dd4e7',
          400: '#71c7e1',
          500: '#55b9d9',
          600: '#399ac0',
          700: '#2d7b9a',
          800: '#235c73',
          900: '#1a3d4d',
        },
        // Gray scale - soft and welcoming
        'gray': {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'playful': ['Fredoka', 'Comic Neue', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-delay': 'fadeIn 0.6s ease-out 0.2s forwards',
        'fade-in-delay-2': 'fadeIn 0.6s ease-out 0.4s forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '33%': { transform: 'translateY(-5px) rotate(1deg)' },
          '66%': { transform: 'translateY(5px) rotate(-1deg)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      transitionDuration: {
        '400': '400ms',
      },
      backgroundImage: {
        'gradient-playful': 'linear-gradient(135deg, #71c7e1 0%, #A8E0A2 50%, #D8B4E2 100%)',
        'gradient-calm': 'linear-gradient(180deg, #f0f9fc 0%, #faf6fc 100%)',
      }
    },
  },
  plugins: [],
}
