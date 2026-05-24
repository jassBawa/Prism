# Prism

**Self-rebalancing index funds on Solana.** Deposit one token, hold a whole basket — a keeper keeps it at target weights automatically.

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.32-512BD4)](https://www.anchor-lang.com)
[![Oracle](https://img.shields.io/badge/Oracle-Pyth%20pull-6E56CF)](https://pyth.network)
[![Status](https://img.shields.io/badge/status-in%20development-f5a623)](#status)

> 🚧 **In active development** — devnet only, unaudited, single centralized keeper, mock swaps. Don't use real funds.

---

## What it is

Pick 2–4 assets and target weights, deposit USDC, and get one **basket token** representing the portfolio. As prices drift the basket goes off target; an off-chain **keeper** rebalances it back using **Pyth** oracle prices. Withdraw anytime for your pro-rata share of every underlying asset.

The whole loop — **deposit → auto-rebalance → withdraw** — works end-to-end on devnet, driven from the dashboard with your own wallet.

## Status

| | |
|---|---|
| ✅ **Shipped** | On-chain program (registry, allowlist, create-basket, deposit, withdraw, rebalance, admin) · Pyth pricing with staleness/confidence guards · user-created 2–4 asset baskets · NAV deposits · in-kind withdrawals · **spread-incentivized permissionless rebalance** (any wallet/arb rebalances for the spread) · **dual drift gate** (absolute + relative) · **creator deposit fee** · multi-basket dashboard · hosted keeper service · negative tests for every guard |
| 🔨 **In progress** | Real DEX swaps via **Jupiter v6** (replacing devnet `mock_swap`) · slippage caps + circuit breaker · keeper hardening (retries, scheduling) |
| 🗓️ **Planned** | Keeper **bounty market** · NAV/APR analytics · Dutch-auction rebalancing · fund-as-LP earning fees · mainnet + audit |

## Run it

The program is deployed + seeded on devnet, so no local infra is needed:

```sh
pnpm setup              # install deps (once)
pnpm seed               # create test mints + demo baskets, fund the admin wallet
pnpm dev                # dashboard → http://localhost:3001 (live devnet)
```

The seeded **admin wallet** holds test USDC; deposit from it via `pnpm deposit <amount>`, or connect any wallet that holds the test USDC mint. Set your wallet to **Devnet**, deposit into a basket, then watch it rebalance. To trigger a rebalance directly:

```sh
pnpm skew sol 300 <BASKET>   # force drift (mints into the SOL vault)
pnpm rebalance <BASKET>      # swap back toward target at oracle ± spread
```

`rebalance` is **permissionless** — any wallet may call it and keep the spread. Full local-validator setup (surfpool) is in [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Program

Anchor (Rust). One program, instructions:

| Instruction | Who | What |
|-------------|-----|------|
| `init_registry` / `set_supported_asset` | admin | create the registry · curate the asset allowlist |
| `create_basket` | anyone | 2–4 allowlisted assets, weights (Σ = 10000 bps), quote asset, thresholds (abs+rel), interval, spread, deposit fee |
| `deposit` | user | quote asset in → mint basket token by NAV; a `deposit_fee_bps` slice goes to the creator |
| `withdraw` | user | burn → in-kind pro-rata of every asset (oracle-free, atomic, fee-free) |
| `rebalance` | **anyone** | dual gate (abs+rel drift) + interval → swap toward target at Pyth price ± `spread`; the caller keeps the spread |
| `set_params` / `set_paused` | owner | tune thresholds/interval/spread/fee · pause |

Custody is entirely on-chain: a Basket PDA owns every vault + the basket-token mint. A rebalance caller can only swap *within* a vault toward target at oracle±spread — it can't mint or withdraw, and the spread is bounded (≤ 1%). Users always exit via the oracle-free in-kind `withdraw`.

## Layout

```
programs/mini_symmetry/   Anchor program (Rust)
sdk/                      TS client — PDAs, accounts, NAV/drift math, Pyth helper
scripts/                  seed · deposit · withdraw · rebalance · skew · fund · negative
keeper/ · ops/            auto-rebalance loop · hosted keeper service
app/                      Next.js dashboard
docs/                     design + deploy docs
```

## Stack

Anchor · Pyth (pull oracle) · `@solana/web3.js` + `@coral-xyz/anchor` · Next.js + wallet-adapter · Node/TS keeper.
