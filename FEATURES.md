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

### F4 — Auto-rebalance
- Basket drifts off target as prices move; system swaps it back to target weights.
- Triggered by **drift threshold** (e.g. 1%) + **min interval** (anti-churn).
- Idle USDC from deposits gets deployed into assets here (the "auto-split").
- **Swap layer:** `mock_swap` at oracle price on devnet / Jupiter on mainnet (same interface).
- *User value:* portfolio stays balanced hands-free.

### F5 — Keeper bot
- Off-chain cron polls drift every ~30s, fires `rebalance` when conditions met.
- Posts Pyth price updates (pull oracle) in the same transaction.
- Single keeper for MVP (**centralized — flagged**, permissionless is later).
- *User value:* the thing that makes "auto" actually happen.

### F6 — Dashboard (frontend)
- Connect wallet; **deposit** + **withdraw** boxes.
- Live view: NAV, basket-token price, **current weights vs target** (bars), drift %,
  last rebalance time, your balance + USD value.
- *User value:* see the fund work in real time.

### F7 — Admin / safety controls
- Pause switch (halt deposit/rebalance).
- Set rebalance threshold + interval.
- Weight-sum validation on init (must = 100%).
- *User value:* a kill-switch and sane configuration.

### MVP non-goals (explicitly excluded)
❌ user-created baskets · ❌ multiple baskets · ❌ permissionless keepers · ❌ Dutch auctions ·
❌ intents/limit orders · ❌ fund-as-LP fees · ❌ management fees · ❌ >5 assets · ❌ mainnet hardening

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

- **Oracle-spread rebalance** — expose cheap oracle-priced swaps; **arbitrageurs rebalance the
  fund for free** (no Jupiter dependency). The core Symmetry insight.
- **Permissionless keeper network** — anyone runs a keeper, paid by **bounties**, racing to execute.
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
