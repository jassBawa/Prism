# Mini-Symmetry — Features

Feature list by phase. MVP first (what we ship now), then the roadmap. See `PLAN.md` for
the build plan and `ARCHITECTURE.md` for how it's wired.

---

## MVP (Phase 1) — ship this

One hardcoded basket: **SOL 50% / JUP 30% / USDC 20%**. Devnet. Full deposit→rebalance→withdraw loop.

### F1 — Deposit USDC, get a basket token
- User deposits **only USDC**; receives a single **basket token** representing the portfolio.
- Mint amount priced by **NAV** (net asset value) — fair share of the fund.
- First deposit bootstraps the basket token at ≈ $1.
- **No swap on deposit** — USDC sits in the vault, deployed on the next rebalance.
- *User value:* one-click multi-asset exposure, no manual buying of each token.

### F2 — Withdraw (in-kind, pro-rata)
- Burn basket tokens → receive your proportional slice of **every** asset the vault holds.
- **Oracle-free, swap-free, atomic** — the safe exit that can't be price-gamed.
- *User value:* exit anytime, trustlessly, exactly your share.

### F3 — NAV pricing (Pyth)
- Live fund value + basket-token price from **Pyth** oracle.
- **Staleness + confidence guards** — bad/old prices are rejected.
- *User value:* honest, real-time fund valuation.

### F4 — Auto-rebalance (dual-threshold, spread-incentivized)
- Basket drifts off target as prices move; system swaps it back to target weights.
- Triggered by a **dual drift gate**: some asset must breach **both** the absolute
  threshold (share of NAV) **and** the relative threshold (vs. its own target), plus a
  **min interval** (anti-churn). The abs gate ignores small wiggles in big slots; the
  rel gate catches a small slot far off its own target.
- The vault fills each leg at **oracle price ± `spread`**, paying the caller a small
  edge — so rebalancing is **profitable for anyone**, not a cost the operator eats.
- Idle USDC from deposits gets deployed into assets here (the "auto-split").
- **Swap layer:** `mock_swap` vs. the caller's own reserve at oracle±spread on devnet /
  Jupiter on mainnet (same interface).
- *User value:* portfolio stays balanced hands-free, and rebalancing pays for itself.

### F5 — Permissionless keeper / arb
- `rebalance` is callable by **any wallet** — the signer is an actor role, not a
  privilege. No trusted operator can be a single point of failure.
- Whoever calls supplies their own asset reserves and pockets the `spread` — an
  external arbitrageur rebalances the fund **for free** (the core Symmetry insight).
- We still run a reference keeper (off-chain cron, posts Pyth updates, fires when the
  dual gate + interval are met), but it's now **one of many possible callers**, not
  load-bearing — if it's down, anyone (or any arb) keeps the fund balanced.
- *User value:* "auto" happens even with no operator; no centralized keeper risk.

### F6 — Dashboard (frontend)
- Connect wallet; **deposit** + **withdraw** boxes.
- Live view: NAV, basket-token price, **current weights vs target** (bars), drift %,
  last rebalance time, your balance + USD value.
- *User value:* see the fund work in real time.

### F7 — Admin / safety controls
- Pause switch (halt deposit/rebalance).
- `set_params`: abs + rel thresholds, interval, spread, deposit fee (bounded:
  spread ≤ 1%, fee ≤ 5%).
- Weight-sum validation on init (must = 100%).
- *User value:* a kill-switch and sane configuration.

### F8 — Creator deposit fee
- A basket creator sets a `deposit_fee_bps` (≤ 5%); on each deposit a slice of the
  newly minted basket tokens is routed to the creator's basket-token account.
- Floors in the depositor's favor — a tiny deposit whose fee rounds to 0 pays nothing.
- **Withdraw stays fee-free** — the oracle-free in-kind exit is left pure.
- *User value:* a revenue stream that makes launching a basket worthwhile.

### MVP non-goals (explicitly excluded)
❌ real-DEX (Jupiter) swaps · ❌ keeper bounty market · ❌ Dutch auctions ·
❌ intents/limit orders · ❌ fund-as-LP fees · ❌ management/performance fees · ❌ >5 assets · ❌ mainnet hardening

---

## Phase 2 — usable product

- **User-created baskets** — pick assets + weights in the UI, deploy your own fund.
- **Multiple baskets** live simultaneously.
- **Per-basket params** — owner sets threshold, interval, asset set.
- **Management fee** — fund creator earns a cut on deposits.
- **Hardened keeper** — confidence checks, retries, multi-basket scheduling.
- **Atomic-ish deposit swap** (optional) — split USDC into assets inside the deposit flow.

---

## Phase 3 — credible

- **Mainnet-beta** with real funds.
- **Slippage caps** on swaps; **circuit breakers**.
- **Robust error handling** — partial-fill, deposit/withdraw atomicity.
- **Audit pass** (internal + external bug review).
- **Analytics** — historical NAV chart, fee-based APR, holder count, volume.

---

## Phase 4 — the real Symmetry magic

- ✅ **Oracle-spread rebalance** — *shipped (F4)*: oracle±spread fills let arbitrageurs
  rebalance the fund for free. (Devnet uses a mock swap vs. the caller's reserve;
  real-DEX execution is below.)
- ✅ **Permissionless rebalance** — *shipped (F5)*: any wallet may call. Still ahead: a
  **bounty market** so callers are also paid task bounties, not just the spread.
- **Real-DEX execution** — route the rebalance legs through **Jupiter v6** on mainnet
  (replacing `mock_swap`), with slippage caps + a circuit breaker.
- **Intents** — "if SOL > $300 sell 10%", scheduled rebalance, limit/bracket orders, DCA, volatility pauses.
- **Fund-as-liquidity-provider** — basket market-makes on aggregators (Jupiter), earning
  **LP/swap fees for holders** — rebalance becomes profitable, not just free.
- **Dutch-auction rebalancing** — oracle snapshot + decaying price + confidence bands for best execution.

---

## Feature → component map (MVP)

| Feature | Program | Keeper | Frontend | Pyth |
|---------|:-------:|:------:|:--------:|:----:|
| F1 Deposit | ● | | ● | ● |
| F2 Withdraw | ● | | ● | |
| F3 NAV | ● | | ● | ● |
| F4 Rebalance | ● | ● | | ● |
| F5 Keeper | | ● | | ● |
| F6 Dashboard | | | ● | ● |
| F7 Admin | ● | | ● | |
