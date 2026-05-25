# Prism — Pitch Deck

> Self-rebalancing index funds on Solana.
>
> Markdown slide outline — one slide per `---`. Paste into Google Slides / Pitch / Keynote,
> or present directly. Speaker prompts are in the `Notes:` lines. Logo assets live in
> `app/public/brand/` (`prism-logo.svg`, `og-image.png`).

---

## 1 · Prism

![Prism](app/public/brand/prism-logo.svg)

### Self-rebalancing index funds on Solana

Deposit one token. Hold a basket that rebalances itself — paid for by arbitrage, not by you.

> Notes: One line. "Prism is the easiest way to hold a diversified, auto-rebalancing
> portfolio on Solana — and the easiest way to launch one." Live on devnet today.

---

## 2 · The problem

**Holding a balanced crypto portfolio is manual, centralized, and leaky.**

- **Manual.** Want SOL + JUP + BONK at fixed weights? Buy each, track ratios, rebalance by
  hand every time the market moves. Most people don't — and drift quietly.
- **Centralized.** Today's on-chain index products lean on a single trusted operator to hold
  assets and decide when to rebalance. Operator goes down → the fund drifts off-target.
- **Leaky.** Rebalancing costs money — slippage and operator fees bleed straight out of
  fund value (NAV), every single rebalance.

> Notes: Everyone gets the "buy the index, not the stock" lesson from TradFi. On-chain, the
> tooling to actually *do* that — passively, trustlessly — barely exists.

---

## 3 · The solution

**Baskets that rebalance themselves through permissionless arbitrage.**

- Deposit **one** asset (e.g. USDC) → receive a **basket token** priced at fair NAV. No
  token-swapping on the way in.
- The fund advertises a small, bounded **spread**. When it drifts, **anyone** can rebalance
  it by trading against the vault at oracle price ± that spread — and pocket the edge.
- Rebalancing becomes *profitable*, so it happens on its own. The cost is paid **to**
  arbitrageurs, **not from** the fund's NAV.
- Exit anytime via **in-kind** withdrawal — your pro-rata slice of every asset, no oracle,
  no slippage, atomic.

> Notes: This is the core flip. TradFi pays operators to rebalance. We make rebalancing a
> profit opportunity, so the market does it for free.

---

## 4 · How it works

**Five steps — create → deposit → drift → rebalance → withdraw.**

1. **Create** — pick 2–4 allow-listed assets and target weights (e.g. SOL 50 / JUP 30 /
   USDC 20). Set a deposit fee and drift thresholds.
2. **Deposit** — user deposits USDC; the program reads vault NAV from **Pyth** and mints
   basket tokens at fair price.
3. **Drift** — off-chain, anyone computes each asset's live weight vs. target.
4. **Rebalance** — when the drift gate trips, a caller supplies their own reserves and
   swaps the vault toward target at **oracle ± spread**, keeping the edge.
5. **Withdraw** — burn basket tokens, receive every underlying asset in-kind. Fee-free.

> Notes: Walk the SOL/JUP/USDC example end to end. Emphasize step 4 needs no permission and
> no trusted operator.

---

## 5 · The insight (why this works)

**The keeper is optional, not load-bearing.**

- Traditional index funds: **operator → paid to rebalance** → single point of failure.
- Prism: **spread → pays the rebalancer** → if our keeper is offline, any profit-seeking bot
  keeps the fund on-target. Incentives, not infrastructure.
- The spread is *bounded* (≤ 1%) and the swap only ever moves the vault **toward** target at
  oracle price — a rebalance can't be used to drain the fund.

> Notes: This is the "Symmetry insight." The protocol turns a cost center (rebalancing) into
> a permissionless, self-healing market.

---

## 6 · Product

**A clean dashboard for baskets — deposit, hold, watch, exit.**

- Multi-basket view: live **NAV**, current vs. target **weights**, real-time **drift %**,
  last-rebalance time.
- One-click **deposit / withdraw** with wallet-adapter.
- Per-asset breakdown with allocation rings and drift badges.

*(Insert 2–3 screenshots: basket grid, basket detail, deposit panel.)*

> Notes: Show, don't tell. The app makes an on-chain index feel like a normal fintech
> portfolio screen.

---

## 7 · Built to be safe

**Conservative by construction — every external input is guarded.**

- **Dual drift gate** — a rebalance only triggers when an asset breaches **both** an
  absolute (% of NAV) **and** a relative (% off its own target) threshold. Kills churn.
- **Oracle guards** — Pyth prices rejected if **stale (> 60s)** or **low-confidence
  (> 2%)**.
- **Bounded spread** — capped at **1%** (`MAX_SPREAD_BPS = 100`); swaps only move toward
  target.
- **Oracle-free exit** — in-kind withdrawal needs no price feed at all; can't be gamed.
- **Admin controls** — asset allow-list + per-basket pause as a safety switch.

> Notes: Security story for technical/investor audiences. Negative tests exist for every one
> of these guards.

---

## 8 · Who it's for

**Four sides of one market — and every side is incentivized.**

| Persona | Does | Gets |
| --- | --- | --- |
| **Creator** | Designs a basket (assets + weights), sets a deposit fee | Revenue on inflows; launch a niche index with no custody or DEX work |
| **Depositor** | Deposits once, holds the basket token | Multi-asset exposure, auto-rebalanced, fair in-kind exit anytime |
| **Keeper / arb** | Monitors drift, calls rebalance with own reserves | Bounded-risk spread income; passive, scalable |
| **Protocol** | Curates the asset allow-list, can pause | Quality control + kill-switch |

> Notes: "Creator" is the growth flywheel — anyone can launch an index, like a token but for
> portfolios.

---

## 9 · Business model

**Two bounded fee surfaces — neither bleeds NAV.**

- **Creator deposit fee** — set per basket, capped at **5%** (`MAX_FEE_BPS = 500`); a slice
  of newly-minted basket tokens, floored in the depositor's favor. Aligns creators to grow
  their fund.
- **Rebalance spread** — capped at **1%**; paid **to** the arbitrageur who rebalances, not
  skimmed from the fund. This is the *cost of staying balanced*, and it's market-priced.
- **No** management fee, **no** performance fee, **fee-free** withdrawals — today.
- **Future protocol revenue**: a small cut of creator fees / spread, plus premium basket
  tooling.

> Notes: Be explicit — withdrawals are intentionally pure. Monetization rides on inflows and
> rebalance volume, both of which scale with AUM.

---

## 10 · Market

**On-chain asset management is early — and Solana is where it's growing.**

- TradFi index/ETF AUM is in the trillions; the "buy the index" behavior is universal.
- DeFi index/structured-product TVL is a tiny fraction of that — the tooling gap is the
  opportunity.
- Solana brings the throughput and fees that make *frequent, cheap* rebalancing actually
  viable on-chain.
- Comparable: **Symmetry** (Solana funds) proved the arbitrage-rebalance model; Prism makes
  it permissionless, creator-launchable, and dead simple.

> Notes: Frame as "Shopify for index funds on Solana" — lower the barrier to *launching* an
> index, not just holding one.

---

## 11 · Status & traction

**MVP is live on devnet — the full loop works end to end.**

- ✅ Deposit → rebalance → withdraw, on-chain, today.
- ✅ Dual drift gate, spread-incentivized permissionless rebalance, creator deposit fee.
- ✅ Pyth oracle with staleness + confidence guards.
- ✅ Test suite green (LiteSVM contract tests + math units, incl. a negative test per guard).
- ✅ Reference keeper + multi-basket dashboard.
- Devnet program: `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`

> Notes: We're not pitching a deck — we're pitching working software. Offer a live devnet
> demo.

---

## 12 · Roadmap

**From devnet MVP to a self-sustaining index market.**

- **Phase 2 — Real liquidity.** Swap the devnet mock for **Jupiter v6** routing; add
  slippage caps + a circuit breaker. Open **user-created baskets** in the UI.
- **Phase 3 — Mainnet.** Harden the keeper, **security audit**, mainnet launch.
- **Phase 4 — Depth.** Keeper **bounty market** (callers paid on top of spread),
  **fund-as-LP** (baskets market-make and earn fees for holders), **Dutch-auction**
  rebalancing, and **intents** (limit orders, DCA, volatility pauses).

> Notes: Each phase is independently valuable. Mainnet + Jupiter is the inflection point for
> real AUM.

---

## 13 · Vision

**Anyone can launch an index fund on Solana in a click — and it runs itself.**

- For holders: diversified, auto-rebalanced exposure with a one-token deposit.
- For creators: a portfolio you can ship like a token.
- For the network: a permissionless, self-healing layer of on-chain funds.

**Prism — index funds on Solana.**

> Notes: Close on the flywheel: more creators → more baskets → more deposits → more rebalance
> volume → more keepers. The protocol gets stronger as it grows.

---

## 14 · Ask / contact

**[Placeholder — fill in before presenting.]**

- **Raising:** $___ to reach mainnet (audit + Jupiter integration + first creators).
- **Looking for:** design partners (basket creators), keeper operators, an audit slot.
- **Contact:** name · email · @handle · demo link

> Notes: Make the ask concrete and specific to the audience. Always end with the live demo
> link.
