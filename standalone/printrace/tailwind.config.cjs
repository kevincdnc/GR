// Configuration Tailwind 3 (reprise du prototype) — police par défaut : Barlow
module.exports = {
  content: ['./index.html', './studio.html', './login.html', './src/**/*.jsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Barlow Semi Condensed', 'Barlow', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
}
