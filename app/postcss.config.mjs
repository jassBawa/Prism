// Tailwind v4 runs as a PostCSS plugin. It only injects utilities/preflight into
// CSS that imports "tailwindcss" (the landing `(site)/site.css`); the dashboard's
// hand-written globals.css has no such import, so it passes through untouched.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
