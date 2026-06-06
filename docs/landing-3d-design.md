# Prism — 3D Landing Design & Layout Plan

> Companion to `landing-content-spec.md`. How to SHOW the content with a 3D-heavy "wow" landing. Pairs the approved section/copy spec with a visual + motion + 3D plan, a performance budget, and an asset list.

## Core concept: "Follow the light through the prism"
One metaphor threads the whole page: **white light enters a prism → refracts into a spectrum → the spectrum *is* the portfolio.** This maps 1:1 to the product (one deposit → diversified basket) and the brand (Prism). A single persistent 3D prism scene transforms as you scroll — light enters (hero) → splits into assets (what's inside) → flows through deposit/rebalance/withdraw (how it works) → projects forward into the roadmap. The prism is the through-line, not disconnected widgets. That continuity is the "crazy."

Bonus: wire **live data** into the 3D (reuse the app's existing Pyth price + basket fetches) — floating coins sized by real basket weights, a live NAV number in the beam, the live price ticker. Decoration + real protocol = credibility.

## Stack decision (the fork)
Current: **OGL** (raw WebGL v1.0.11) + hand-written GLSL raymarch prism (`components/Prism.tsx`) + `motion/react` v12 + Lenis + Matter.js. Tailwind v4, Inter + Newsreader. No Three.js / R3F / GLTF loader / postprocessing lib.

- **Path A — extend OGL + shaders.** Keep the stack; do everything procedurally (prism, particle spectrum, shader sections). Lighter bundle, no new deps. BUT: realistic glass refraction + loading 3D *models* (coins, crystals) is hard/manual; more shader hand-work.
- **Path B — add `@react-three/fiber` + `@react-three/drei` (+ `@react-three/postprocessing`). RECOMMENDED for "cool 3D models."** Gives: real glass via `MeshTransmissionMaterial` + `Environment` (HDRI, presets built in), trivial GLTF model loading, `Bloom`/chromatic-aberration postFX, `ScrollControls` for scroll-scrubbed 3D. The right tool for the ask. Cost: ~Three.js (~150KB gz) + needs a disciplined mobile/reduced-motion fallback. Keep the existing OGL prism shader as the lightweight mobile/fallback render.

Recommendation: **Path B**, single persistent `<Canvas>`, with the OGL shader (or a static poster) as the mobile/reduced-motion fallback.

## Section-by-section layout + 3D treatment
1. **Hero — the signature moment.** Large glass prism (real refraction). A white light beam enters one face, exits as a rainbow spectrum fanning behind the headline "One deposit. A whole portfolio." Interactive: prism rotates to cursor/gyro; beam follows. Literally visualizes one input → diversified output. *Tech:* MeshTransmissionMaterial + Environment(HDRI) + emissive beam + Bloom + subtle chromatic aberration.
2. **What's inside — spectrum resolves into assets.** The refracted colors condense into floating token coins (SOL/JUP/USDC), each glowing its brand color (#9945FF / #38bdf8 / #2563eb), arranged as a 3D ring (the donut, in 3D), **sized by live basket weights**. *Tech:* flat coin discs with token-logo textures (no model needed) OR a single coin GLTF re-skinned per asset.
3. **How it works — scroll-scrubbed 3-beat story.** (1) Deposit: a USDC coin flies INTO the prism. (2) Stay balanced: inside, weight bars snap to target (the rebalance). (3) Withdraw: coins fan back OUT to the user. *Tech:* ScrollControls timeline (or motion `useScroll` driving r3f state); camera orbits the persistent prism.
4. **Why Prism — floating glass cards.** The 4 value props as refractive glass cards with depth + hover tilt; the "Peg-aware (coming soon)" card glows/pulses differently. *Tech:* glassmorphism + 3D tilt; can be CSS/motion (cheap) over the canvas.
5. **Who it's for — keep the Matter.js physics pit.** Already unique + cool; low priority to change. Optionally restyle chips to match.
6. **Roadmap / Coming soon — the light projects forward.** The spectrum continues into depth; each roadmap item (RWA, Stable-Guard, 60/40, governance, mainnet) is a holographic "station" along the beam, labeled *Coming soon*. *Tech:* curve/path with cards + scroll camera dolly; or a calmer 2D card grid with a 3D beam backdrop if perf-constrained.
7. **Transparency / Built-on — partner marquee.** Keep `PartnerMarquee` (Solana/Pyth/Anchor/Raydium/Jupiter); optional 3D logo loop. Low priority.
8. **FAQ + Footer — calm down.** Mostly 2D; let the page breathe after the 3D crescendo. Faint static prism in the footer.

## Scroll choreography
One pinned `<Canvas>` spanning the hero→roadmap range; Lenis + motion `useScroll` (or drei `ScrollControls`) drive a single normalized scroll value → camera position + prism state + beam progress. Sections 7–9 release the canvas to static. The prism never disappears; it *becomes* each section.

## Performance & accessibility budget (non-negotiable for heavy 3D)
- **One** persistent Canvas (never one-per-section).
- **Lazy-load** the Canvas via `next/dynamic({ ssr:false })` + `<Suspense>` + a static poster image fallback (no layout shift).
- **Mobile / coarse-pointer / low-DPR:** serve a lighter render — static prism image, or the existing OGL shader, fewer/no particles, NO MeshTransmissionMaterial (it's expensive). Detect via `matchMedia` (pattern already used in `who-its-for.tsx`).
- **`prefers-reduced-motion`:** freeze to a static hero render (Lenis/motion/Matter already respect it — extend to the 3D loop, which currently doesn't).
- DPR clamp `min(2, dpr)` (already done in Prism); Bloom at half-res; TransmissionMaterial samples ≤ 6; suspend RAF offscreen (IntersectionObserver pattern already exists).
- Models: tiny + draco-compressed (<200KB); prefer procedural geometry (a triangular prism + coin discs need NO asset files). HDRI: use drei `Environment` presets (no asset) or a compressed `.hdr`.

## Asset list — what helps + where to get it
Most of the "crazy 3D" needs **zero external model files** (procedural prism + drei Environment presets + flat coin discs with logo textures). The one thing I genuinely can't fabricate is **official brand/token logos**. Tiers:

**MOST USEFUL (please grab — I can't make these):**
- **Brand logos** (SVG/PNG, official kits): Solana `solana.com/branding`, Pyth `pyth.network` media kit, Jupiter `station.jup.ag` brand, Raydium docs/press, Anchor (GitHub). For the Built-on strip + 3D logo loop.
- **Token marks** for SOL / JUP / BONK / USDC (the display logos — note our mints are test mints, but use the real logos for UI). Official sites or CoinGecko asset pages.

**NICE (improves realism; optional — I have fallbacks):**
- **1 HDRI environment map** for glass reflections — `polyhaven.com/hdris` (CC0). Pick a neutral studio or a colorful one. (Else I use a drei built-in preset = no asset.)
- **Display font** for the hero, if you want more punch than Newsreader — `fontshare.com` (Clash Display, Satoshi; free) or Google Fonts.

**OPTIONAL (only if you want specific models instead of procedural):**
- **Coin / crystal GLTF** — `poly.pizza` (CC0), `quaternius.com` (CC0), or `sketchfab.com` (filter Downloadable + CC0). Else I generate procedurally.
- **Lottie** motion accents — `lottiefiles.com` (free).
- **Matcaps** for stylized materials — `github.com/nidorx/matcaps`.
- **OG share image + favicon** — for grant-submission polish (can be designed from the prism render).

## Decisions needed from you
1. **Stack:** Path B (add r3f+drei — recommended for models) or Path A (stay OGL/shaders, lighter)?
2. **Ambition vs perf:** full scroll-scrubbed persistent-prism story (max wow) vs per-section 3D accents (safer, faster to ship)?
3. **Assets:** will you grab the brand/token logos (most useful)? Any specific 3D model you want featured, or go procedural?
4. **Tone/brand:** keep the gold accent (`#c8a951`) + spectrum, or shift palette? Any wordmark/logo for "Prism"?

## Verification (when built)
- Desktop: full 3D scene 60fps; scroll story coherent; live data wired (weights/NAV/prices).
- Mobile: lighter fallback renders, no jank, no >2.5s LCP regression.
- `prefers-reduced-motion`: static, no animation.
- Lighthouse: perf not tanked by the canvas (lazy-loaded, poster fallback).
