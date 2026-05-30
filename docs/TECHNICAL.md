# Prism — Technical Guide

Engineering reference for Prism: the on-chain program, custody model, instruction set, local setup, and CLI. For the product overview, see the [README](../README.md).

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.32-512BD4)](https://www.anchor-lang.com)
[![Oracle](https://img.shields.io/badge/Oracle-Pyth%20pull-6E56CF)](https://pyth.network)

---

## Architecture at a glance

Prism is one Anchor program plus off-chain helpers:

- **On-chain program** — owns every vault and the basket-token mint, prices baskets from Pyth, and enforces all the guards. Custody never leaves the chain.
- **Keeper** — an off-chain loop that reads on-chain state, computes drift, posts fresh Pyth updates, and calls `rebalance`. The rebalance itself is permissionless, so the keeper is just a convenience, not a trusted party.
- **Dashboard** — a Next.js app (wallet-adapter) for browsing, creating, depositing, withdrawing, and triggering rebalances.

Deeper design docs: [ARCHITECTURE](./ARCHITECTURE.md) · [FEATURES](./FEATURES.md) · [PLAN](./PLAN.md) · [SHIP](./SHIP.md) · [MVP_SHIP](./MVP_SHIP.md) · [DEPLOY](./DEPLOY.md).

## Status

| | |
|---|---|
| ✅ **Shipped** | On-chain program (registry, allowlist, create-basket, deposit, withdraw, rebalance, admin) · Pyth pricing with staleness/confidence guards · user-created 2–4 asset baskets · NAV deposits · in-kind withdrawals · **spread-incentivized permissionless rebalance** (any wallet/arb rebalances for the spread) · **dual drift gate** (absolute + relative) · **creator deposit fee** · multi-basket dashboard · hosted keeper service · negative tests for every guard |
| 🔨 **In progress** | Real DEX swaps via **Jupiter v6** (replacing the devnet `mock_swap`) · slippage caps + circuit breaker · keeper hardening (retries, scheduling) |
| 🗓️ **Planned** | Keeper **bounty market** · NAV/APR analytics · Dutch-auction rebalancing · fund-as-LP earning fees · mainnet + audit |

## Run it

The program is deployed and seeded on devnet, so no local infrastructure is required:

```sh
pnpm setup              # install deps (once)
pnpm seed               # create test mints + demo baskets, fund the admin wallet
pnpm dev                # dashboard → http://localhost:3001 (live devnet)
```

The seeded **admin wallet** holds test USDC. Deposit from it via `pnpm deposit <amount>`, or connect any wallet holding the test USDC mint. Set your wallet to **Devnet**, deposit into a basket, then watch it rebalance.

Trigger a rebalance directly:

```sh
pnpm skew sol 300 <BASKET>   # force drift (mints into the SOL vault)
pnpm rebalance <BASKET>      # swap back toward target at oracle ± spread
```

`rebalance` is **permissionless** — any wallet may call it and keep the spread. Full local-validator setup (surfpool) is in [DEPLOY.md](./DEPLOY.md).

## Program

Anchor (Rust). One program, with these instructions:

| Instruction | Who | What |
|-------------|-----|------|
| `init_registry` / `set_supported_asset` | admin | create the registry · curate the asset allowlist |
| `create_basket` | anyone | 2–4 allowlisted assets, weights (Σ = 10000 bps), quote asset, thresholds (abs+rel), interval, spread, deposit fee |
| `deposit` | user | quote asset in → mint basket token by NAV; a `deposit_fee_bps` slice goes to the creator |
| `withdraw` | user | burn → in-kind pro-rata of every asset (oracle-free, atomic, fee-free) |
| `rebalance` | **anyone** | dual gate (abs+rel drift) + interval → swap toward target at Pyth price ± `spread`; the caller keeps the spread |
| `set_params` / `set_paused` | owner | tune thresholds/interval/spread/fee · pause |

### Custody & safety model

Custody is entirely on-chain: a **Basket PDA owns every vault and the basket-token mint**. A `rebalance` caller can only swap *within* a vault toward target at oracle ± spread — it can't mint or withdraw, and the spread is bounded (≤ 1%). Users always exit through the oracle-free, in-kind `withdraw`, so an unavailable or misbehaving keeper can never trap funds.

Guards include: Pyth staleness + confidence checks, weight-sum validation (Σ = 10000 bps), asset allowlist binding (mint ↔ Pyth feed ↔ decimals), vault-substitution defense (ATA derivation + SPL unpack), virtual-offset inflation guard, and bounded spread/fee. Every guard has a negative test.

## Repo layout

```
programs/mini_symmetry/   Anchor program (Rust)
sdk/                      TS client — PDAs, accounts, NAV/drift math, Pyth helper
scripts/                  seed · deposit · withdraw · rebalance · skew · fund · negative
keeper/ · ops/            auto-rebalance loop · hosted keeper service
app/                      Next.js dashboard (marketing site at /, app at /app)
docs/                     design + deploy docs
```

## Stack

Anchor · Pyth (pull oracle) · `@solana/web3.js` + `@coral-xyz/anchor` · Next.js + wallet-adapter · Node/TS keeper.

## Common scripts

| Command | Does |
|---------|------|
| `pnpm seed` | create test mints + demo baskets, fund admin |
| `pnpm deposit <amount> [basket]` | deposit quote asset, mint basket tokens |
| `pnpm withdraw <amount> [basket]` | burn basket tokens, redeem in-kind |
| `pnpm rebalance [basket]` | permissionless rebalance toward target |
| `pnpm skew <asset> <usd> [basket]` | force drift for a demo |
| `pnpm show [basket]` | print basket state (weights, NAV, drift) |
| `pnpm negative` | run the guard-rejection tests |
| `pnpm keeper` | run the auto-rebalance loop |
