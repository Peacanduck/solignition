/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:     { DEFAULT: '#0a0d0c', 1: '#0f1311', 2: '#131816', 3: '#1a201d' },
        ink:    { DEFAULT: '#e8ede9', 2: '#b4bcb6', 3: '#6e7570', 4: '#444844' },
        line:   { DEFAULT: '#1f2421', 2: '#2a302c', 3: '#3a4039' },
        accent: 'var(--accent)',
        'accent-2':    'var(--accent-2)',
        'accent-soft': 'var(--accent-soft)',
        'accent-edge': 'var(--accent-edge)',
        warn:   'var(--warn)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.02em',
      },
      maxWidth: {
        article: '760px',
        shell:   '1480px',
      },
      gridTemplateColumns: {
        shell:    '260px minmax(0, 1fr)',
        'main-toc': 'minmax(0, 1fr) 220px',
      },
    },
  },
  plugins: [],
};
