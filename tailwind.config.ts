import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        syncbox: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#baddff',
          300: '#7cc2ff',
          400: '#36a3ff',
          500: '#0c87f2',
          600: '#006acf',
          700: '#0054a8',
          800: '#04488a',
          900: '#0a3d72',
          950: '#06264b',
        },
      },
    },
  },
  plugins: [],
}

export default config
