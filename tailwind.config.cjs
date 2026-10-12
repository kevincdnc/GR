// Même configuration que le `tailwind.config` inline du prototype (CDN Tailwind 3)
module.exports = {
  content: ['./index.html', './src/**/*.jsx', './tweaks-panel.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
}
