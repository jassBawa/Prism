// Tailwind v4 runs as a PostCSS plugin. Utilities are injected into CSS files
// that `@import "tailwindcss"` — both `(site)/site.css` and `(app)/globals.css`.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
