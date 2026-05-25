# Prism — brand assets

Logo for **Prism · Index funds on Solana**. A geometric **P** monogram in a rounded
graphite square, with a single diagonal *refraction* glint — a nod to a prism splitting
light (the sky-blue streak across the dark gradient).

## Files

| File | Use |
| --- | --- |
| `prism-icon.svg` | Primary mark. App icon / avatar — white P on the gradient square. |
| `prism-mark.svg` | Bare P (gradient on transparent). Use on white/light surfaces where the square isn't wanted. |
| `prism-logo.svg` | Horizontal lockup (icon + "Prism" + tagline) for **light** backgrounds. |
| `prism-logo-dark.svg` | Same lockup for **dark** backgrounds. |
| `favicon.svg` | Simplified mark (no refraction detail) that stays legible at 16px. Also copied to `public/favicon.svg`. |
| `prism-icon-{512,256,128}.png` | Raster app icons. |
| `apple-touch-icon-180.png` | iOS home-screen icon. |
| `favicon-{32,16}.png` | Raster favicons. |
| `og-image.png` | 1200×630 social/share card. |

## Palette

| Token | Hex |
| --- | --- |
| Graphite (light stop) | `#334155` |
| Graphite (dark stop) | `#0B1220` |
| Refraction (sky) | `#38BDF8` |
| Ink | `#0F172A` |
| Muted | `#64748B` |
| Paper | `#FBFBFD` |

Brand gradient: `linear-gradient(135deg, #334155, #0B1220)`. Type: **Inter** (700 display,
600 sub, 500 body), display letter-spacing `-0.02em`.

## Usage

- **Clear space:** keep padding ≥ the height of the rounded square's corner radius (≈ ¼ of
  the icon) on all sides of the lockup.
- **Min size:** lockup ≥ 120px wide; bare icon ≥ 24px (use `favicon.svg` below 32px).
- **Don't** recolor the P, stretch the square, drop the rounded corners, or place the
  light-bg lockup on a busy/dark photo (use `prism-logo-dark.svg`).

## Regenerating the PNGs

SVGs are the source of truth. To re-export rasters after editing an SVG:

```sh
# from the app/ directory (sharp is a devDependency)
node scripts/export-brand.mjs
```

No `sharp`? Any SVG→PNG tool works (e.g. `rsvg-convert`, Inkscape, or an online converter)
— the sizes are listed in the table above.

## Optional: wire up the favicon

Assets are standalone — the app is unchanged. To make Next.js serve the favicon
automatically, drop a one-line re-export at `app/icon.svg`:

```ts
// app/icon.svg  — or simply copy public/brand/favicon.svg to app/icon.svg
```

(Next.js App Router auto-detects `app/icon.svg` / `app/apple-icon.png` and injects the
`<link>` tags — no change to `layout.tsx` needed.)
