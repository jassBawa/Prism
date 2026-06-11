# Prism

### One deposit, a whole portfolio — that rebalances itself.

Prism turns a single deposit into a diversified basket of crypto assets and keeps that basket on target automatically. It is an **index fund for Solana** — on-chain, self-custodied, and open to anyone.

> **Live on Solana devnet.** This is a working reference implementation, not real money. It is unaudited — do not deposit funds you can't afford to lose.

---

## The problem

Building a diversified crypto position is more work than it should be:

- You buy several tokens by hand, across different screens.
- The moment prices move, your mix drifts away from what you wanted.
- Fixing it means rebalancing manually — more trades, more fees, more slippage, more time.
- And you watch constantly, because the market never closes.

Most people don't. They hold one or two tokens and hope.

## What Prism does

A **basket** is a set of 2–4 assets with target weights (for example 50% SOL, 30% JUP, 20% USDC), wrapped into a **single token** you hold in your own wallet.

- **Deposit once.** Put in USDC — or any subset of the underlying assets — and receive one basket token representing the whole mix, priced at live net asset value (NAV).
- **It stays on target.** When weights drift, a permissionless keeper trades the basket back to target on Raydium, using live [Pyth](https://pyth.network) oracle prices.
- **Leave whenever.** Redeem your basket token any time for your exact share of every asset inside — in-kind, oracle-free, no lock-ups.

One token to hold. No manual rebalancing. No babysitting.

## Features

Everything below is built and demonstrable on devnet today.

- **One-token deposit, NAV-priced.** Deposit the quote asset and mint basket tokens at the basket's live net asset value. The first deposit bootstraps the token at ≈ $1.
- **Multi-asset (in-kind) deposit.** Contribute any subset of a fund's underlying tokens and mint by total USD value — no forced swap into a single quote leg.
- **In-kind withdrawal.** Burn basket tokens and receive a pro-rata slice of *every* underlying asset. Oracle-free, swap-free, atomic — an exit that can't be price-gamed.
- **Pyth-priced valuation.** NAV and basket-token price come from [Pyth](https://pyth.network) feeds, with staleness and confidence guards so a bad print can't move your money.
- **Automatic rebalancing.** A dual drift gate (absolute share of NAV *and* relative to target) plus a minimum interval triggers rebalances back to target weights.
- **Real Raydium execution.** Rebalance legs route through a Raydium CPMM swap signed by the basket PDA, bounded by the oracle price. A mock oracle±spread swap is used where pool liquidity isn't available.
- **Permissionless keeper.** Anyone can trigger a rebalance and earn the spread — the fund keeps itself on target even with no operator. A reference keeper runs as one caller among many, not a single point of failure.
- **Time-locked governance (Intents).** Owners can't change fund parameters instantly. Changes are proposed, time-locked, then applied by anyone once the delay elapses — so depositors see a change coming and can exit first.
- **Curated asset allowlist.** A `SupportedAsset` PDA per mint binds `(mint, Pyth feed, decimals)` on-chain, so a creator can't pair a cheap token with an expensive feed or misreport decimals.
- **Creator fee.** A basket creator sets a deposit fee (≤ 5%, floored in the depositor's favor); withdrawals stay fee-free.
- **Pause control.** Owners can halt deposits and rebalancing as a kill-switch; in-kind withdrawal always stays available.
- **Dashboard.** Explore funds, deposit and withdraw, watch live NAV, drift, holders, a NAV history chart, and per-fund operator controls.

## How it works

| Step | What happens |
|------|--------------|
| **1. Deposit** | You send USDC (or underlying assets) and receive a basket token priced at the basket's live NAV. |
| **2. Stay balanced** | A keeper watches each asset's drift and rebalances back to target when both the absolute and relative gates breach — on Raydium, oracle-bounded, around the clock. |
| **3. Withdraw** | You burn your basket token and receive your pro-rata share of every underlying asset — directly, with no swap and no slippage. |

## Why it's different

- **One token is a full portfolio.** Hold, transfer, or compose it like any SPL token.
- **Rebalancing is automatic and self-funding.** Set targets once; whoever rebalances earns the spread, so it costs the operator nothing.
- **Honestly priced.** Every deposit and rebalance uses Pyth prices with staleness and confidence checks.
- **You stay in control.** Funds live in on-chain vaults owned by the basket itself. The exit is always a simple, oracle-free, in-kind withdrawal.
- **Can't be quietly changed.** Parameter changes are time-locked; depositors always get a window to leave first.
- **Open by design.** Anyone can create a basket, and anyone can rebalance one.

## Architecture

- **Program** — Anchor, on Solana devnet: `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`. Instructions cover create / deposit / deposit-assets / withdraw / rebalance / rebalance-one / propose-activate-cancel intent / pause / supported-asset registry.
- **Keeper** — off-chain service that posts fresh Pyth updates and fires `rebalance` when the drift gate and interval are met. Hosted, but non-load-bearing — any wallet can take its place.
- **Pricing** — Pyth pull oracle with staleness and confidence bounds.
- **Execution** — Raydium CPMM swaps for real rebalancing; oracle±spread mock swap as a fallback.
- **Frontend** — Next.js app (marketing site + dashboard) with live NAV, drift, and operator controls.

## Quickstart

The app runs against live devnet — no local validator needed beyond installing and seeding:

```sh
pnpm setup    # install dependencies (once)
pnpm seed     # create test assets + demo baskets
pnpm dev      # open the dashboard at http://localhost:3001
```

Set your wallet to **Devnet**, then deposit into a basket and watch it rebalance.

## Documentation

The full picture — on-chain program, custody model, instructions, keeper, and deployment — lives in the **[Technical Guide](./docs/TECHNICAL.md)**, with deeper notes in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/FEATURES.md`](./docs/FEATURES.md).

---

<sub>Built on **Solana** · priced by **Pyth** · executed on **Raydium** · powered by **Anchor** + **SPL Token**. Program (devnet): [`8TrJeQa…X3jbe`](https://explorer.solana.com/address/8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe?cluster=devnet)</sub>
