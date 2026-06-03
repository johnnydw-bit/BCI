import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bramley: {
          primary:   '#231d45',
          secondary: '#27276d',
          gold:      '#ffcc00',
          navy:      '#231d45',   // alias
          blue:      '#27276d',   // alias
          bg:        '#f0f2f5',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
        pill: '20px',
      },
    },
  },
  plugins: [],
}

export default config
