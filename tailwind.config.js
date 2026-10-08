/** Tailwind is compiled ahead of time into css/styles.css (committed), so the
 *  deployed site needs no build step. Re-run `npm run build` only after you
 *  add or change utility classes in index.html or js/. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./index.html', './404.html', './js/**/*.js'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        'line-strong': v('line-strong'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        mark: v('mark'),
        ok: v('ok'),
        warn: v('warn'),
        bad: v('bad'),
        info: v('info'),
        plum: v('plum'),
        code: v('code'),
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { card: '12px', ctl: '8px', chip: '6px' },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
      },
      screens: { xs: '400px' },
      maxWidth: { read: '46rem' },
    },
  },
  plugins: [],
};
