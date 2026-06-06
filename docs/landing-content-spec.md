# Prism — Landing Page Content & Structure Spec

> Brief for an implementation agent. Repositions the marketing landing (`app/app/(site)/`) from a generic SOL/JUP/USDC "educational reference" into a grant-ready **on-chain index-fund layer for Solana**, with a self-managing / peg-watching differentiator and an honest RWA roadmap. Stay 100% honest: devnet, controlled test mints, unaudited, RWA = coming soon.

## Positioning
- **DEFAULT (recommended):** hero leads with the broad index-fund promise (true today); RWA / peg-watch rides as the differentiator + roadmap (labeled "coming soon"). Never claim RWA / Stable-Guard / mainnet are live.
- **Alt (aggressive):** hero leads with RWA headline (e.g. `Index funds for the tokenized economy.`) — bigger narrative bet, more aspirational. Use only if the grant submission wants RWA up top.
- Brand stays **Prism**. Keep the rotating-prism hero animation.

## Current landing audit (what we have → verdict)
Route: `app/app/(site)/page.tsx`; copy in `app/lib/site/config.ts` + per-component strings.

| # | Section | File | Verdict |
|---|---|---|---|
| 1 | Hero ("One deposit. A whole portfolio.") | `components/site/hero-orbit.tsx`, `config.ts:9-13` | KEEP structure+animation; broaden subcopy off "SOL, JUP, USDC"; fix dead "Learn more" link. |
| 2 | What's inside (donut, ticker, Pyth callout) | `components/site/whats-inside.tsx` | KEEP; broaden so the 3 tokens are an *example*, not the identity. |
| 3 | How it works (3 steps) | `components/site/how-it-works.tsx`, `config.ts:15-64` | KEEP — accurate; minor reword, broaden assets. |
| 4 | Who it's for | `components/site/who-its-for.tsx:20-52` | KEEP + strengthen; align RWA bullet with roadmap. |
| 5 | FAQ (6 Qs) | `components/site/faq-section.tsx`, `config.ts:66-108` | KEEP + update; add "create your own basket?" + "what's coming?". |
| 6 | Footer | `components/site/footer.tsx` | KEEP; fix dead docs link; reframe "educational reference" (keep unaudited caveat). |

**ADD:** (A) **Why Prism / self-managing** differentiator · (B) **Roadmap / Coming soon** (the RWA list) · (C) optional **Transparency** strip.

**REMOVE / FIX:**
- Dead `DOCS_URL = "#"` → real docs URL or drop all "Docs"/"Learn more"/"Read docs" links.
- Narrow "SOL, JUP, and USDC" framing in hero/how-it-works/FAQ → broaden to "diversified on-chain assets" (keep the 3-asset basket as a shown example).
- "educational reference build" tone → "live devnet protocol, mainnet roadmap" (relocate unaudited/test-mint honesty to footer + one FAQ, don't delete it).
- Rebalance copy must cover BOTH real-Raydium and mock-reserve paths; assets are test mints.

## Target section order
1. Hero 2. What's inside 3. How it works 4. **Why Prism** ← NEW 5. Who it's for 6. **Roadmap / Coming soon** ← NEW 7. Transparency / Built-on 8. FAQ 9. Footer

## Copy bank (ready-to-use; honest)

### 1. Hero
- Eyebrow: `Live on Solana devnet`
- Headline: `One deposit. A whole portfolio.`
- Subcopy: `Diversified on-chain exposure in a single token — priced by Pyth, kept on target by auto-rebalancing keepers, and redeemable in-kind anytime.`
- CTAs: `Open App` → `/app`; `Read docs` (only if docs exist, else remove).
- Nav tagline: `The on-chain index-fund layer for Solana`

### 2. What's inside
- Eyebrow: `What's inside` · Headline: `A diversified basket, in a single token.`
- Body: `One mint represents weighted exposure to every asset in the vault. Hold it, transfer it, or redeem it for the underlying — no swaps, no slippage. (Example below: a 3-asset blue-chip basket.)`
- KEEP Pyth callout (NAV on-chain from Pyth, staleness + confidence guarded).

### 3. How it works
1. `Deposit` — `Send USDC (or any underlying) and receive basket tokens minted at live NAV, priced from Pyth oracles.`
2. `Stay balanced` — `A keeper watches weight drift and rebalances back to target — on real DEX liquidity (Raydium) or oracle-priced reserves. No manual work.`
3. `Withdraw anytime` — `Burn your basket token for a pro-rata, in-kind share of every asset. Atomic, oracle-free, no slippage.`

### 4. Why Prism (NEW — differentiator / wedge)
- Eyebrow: `Why Prism` · Headline: `Not just an index — a self-managing one.`
- Body: `Most on-chain baskets are static. Prism baskets keep themselves on target, prove every weight and trade on-chain, and (soon) watch their own pegs.`
- 4 cards (first 3 real, 4th labeled coming-soon):
  - `Auto-rebalanced` — `Keepers correct drift the moment weights move past target — via Raydium or oracle-priced reserves.`
  - `In-kind redemption` — `Exit to the real underlying assets, atomically, with zero swap slippage.`
  - `Pyth-priced NAV` — `Every mint and redeem clears at live oracle NAV, guarded by staleness + confidence checks.`
  - `Peg-aware (coming soon)` — `Stablecoin & RWA baskets that auto-exit any holding that breaks its peg.`

### 5. Who it's for
Traders · DAOs & Treasuries · RWAs & Structured Products (xStocks = *coming soon*, not present) · Managers & Funds.

### 6. Roadmap / Coming soon (NEW)
- Eyebrow: `Roadmap` · Headline: `Where Prism is going.`
- Intro: `Prism today is a working devnet engine for tokenized index funds. Next, we point that engine at the assets and risks that matter.`
- Cards (each labeled Coming soon / Planned):
  - **RWA baskets — tokenized equities & treasuries** — `Index the tokenized stock market on Solana (xStocks: AAPLx, NVDAx, TSLAx, SPYx) and tokenized T-bills (Ondo, BlackRock BUIDL) — one token, auto-rebalanced. Mainnet (real assets are Token-2022 + KYC-gated).`
  - **Stable-Guard — depeg-protected stablecoin index** — `Hold the dollar across issuers (USDC / PYUSD / USDG). The keeper auto-exits any stablecoin that drifts off $1.`
  - **All-weather 60/40** — `The classic stock + treasury portfolio, on-chain and self-rebalancing.`
  - **On-chain governance (intents + time-locks)** — `Weight and fee changes are proposed on-chain with a delay + exit window before they take effect — no surprise rug.`
  - **Mainnet** — `Route to real DEX liquidity (Jupiter/Raydium) and real RWA tokens.`
- Honesty line: `Roadmap items are not live yet. Today's app runs on Solana devnet with controlled test mints.`

### 7. Transparency / Built-on
- `Built on Solana · Pyth · Anchor · SPL · Raydium · Jupiter`
- `Every basket, weight, and rebalance is verifiable on-chain.` + `View the program on Solana Explorer` (`EXPLORER_URL`).

### 8. FAQ (keep 6, update + add 2)
Update: What is Prism? (broaden) · How priced? (Pyth) · Keeper? (drift gate; Raydium *or* oracle-priced reserve) · Withdrawals? (in-kind, oracle-free) · Mainnet? (devnet today, roadmap) · Production-ready? (working devnet reference, **unaudited**, **test mints — not real tokens**).
Add: `Can I create my own basket?` → `Yes — permissionless. Pick 2–4 supported assets and target weights.` · `What's coming?` → point to Roadmap.

### 9. Footer
Tagline: `On-chain index funds on Solana. A working devnet reference — deposit once, hold a single balanced basket token.` Keep `© Prism` + `Solana · Devnet`. Fix dead docs link. Add socials if available.

## Honesty guardrails (apply everywhere)
- Assets are controlled **devnet test mints** (SOL/JUP/BONK/USDC), NOT real tokens.
- Rebalance = real on Raydium when a pool exists, else oracle-priced mock reserves.
- **Unaudited**, devnet only — one explicit caveat (footer + FAQ).
- RWA / Stable-Guard / intents / mainnet = roadmap, always labeled.
- NAV history = best-effort (DynamoDB, 30d) — don't promise uptime.

## Implementation notes
- Most copy → `app/lib/site/config.ts` (HERO, STEPS, SHOWCASE, FAQ, STACK, URLs). Edit there first.
- New sections (Why Prism, Roadmap, Transparency): new components in `app/components/site/` following `how-it-works.tsx` / `who-its-for.tsx` patterns (Reveal + eyebrow/headline/grid). Register in `app/app/(site)/page.tsx` in the order above.
- Reuse: `Reveal`, eyebrow/headline pattern, card grid, `PartnerMarquee`. No new design system.
- Broaden hardcoded assets: `whats-inside.tsx:10-14`, hero/how-it-works copy in `config.ts`.
- Fix `DOCS_URL`. Add a small "Coming soon" pill (reuse DriftBadge-style).
- Marketing `(site)` route only — don't touch `/app` (the product).

## Verification
- `pnpm --filter app dev`, open `/` — 9 sections in order, animations intact, no dead links.
- Grep: no "SOL, JUP, and USDC" as the *sole* identity; unaudited + test-mint caveat present once; nothing claims RWA/Stable-Guard/mainnet are live; roadmap cards labeled "Coming soon".
- Mobile + dark check.
