// Configuration Tailwind 3 (reprise du prototype) — polices GR planner : Barlow
module.exports = {
  content: ['./index.html', './src/**/*.jsx', './tweaks-panel.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Barlow Semi Condensed', 'Barlow', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
}
