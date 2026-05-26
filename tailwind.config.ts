import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif']
      },
      colors: {
        ink: '#1a1a1a',
        paper: '#fafaf7',
        muted: '#6b6b6b',
        accent: '#c2410c'
      }
    }
  },
  plugins: []
} satisfies Config
