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
| ✅ **Shipped** | On-chain program (registry, allowlist, create-basket, deposit, withdraw, rebalance, admin) · Pyth pricing with staleness/confidence guards · user-created 2–4 asset baskets · NAV deposits · in-kind withdrawals · keeper auto-rebalance loop · multi-basket dashboard · faucet + hosted ops · negative tests for every guard |
| 🔨 **In progress** | Real DEX swaps via **Jupiter v6** (replacing devnet `mock_swap`) · slippage caps + circuit breaker · keeper hardening (retries, scheduling) |
| 🗓️ **Planned** | Creator fees · NAV/APR analytics · permissionless keeper network · oracle-spread rebalancing (arbs rebalance for free) · fund-as-LP earning fees · mainnet + audit |

## Run it

The program is deployed + seeded on devnet, so no local infra is needed:

```sh
pnpm setup              # install deps (once)
pnpm dev                # dashboard → http://localhost:3001 (live devnet)
pnpm fund <WALLET>      # SOL + test USDC, so you can deposit
```

Set your wallet to **Devnet**, connect, deposit USDC into a basket, then watch the keeper rebalance it. Full local-validator setup (surfpool) is in [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Program

Anchor (Rust). One program, instructions:

| Instruction | Who | What |
|-------------|-----|------|
| `init_registry` / `set_supported_asset` | admin | create the registry · curate the asset allowlist |
| `create_basket` | anyone | 2–4 allowlisted assets, weights (Σ = 10000 bps), quote asset, threshold/interval |
| `deposit` | user | quote asset in → mint basket token by NAV |
| `withdraw` | user | burn → in-kind pro-rata of every asset (oracle-free, atomic) |
| `rebalance` | keeper | drift ≥ threshold + interval → swap toward target at Pyth price |
| `set_params` / `set_paused` | owner | tune threshold/interval · pause |

Custody is entirely on-chain: a Basket PDA owns every vault + the basket-token mint. The keeper can only swap *within* a vault toward target — it can't mint or withdraw. Users always exit via the oracle-free in-kind `withdraw`.

## Layout

```
programs/mini_symmetry/   Anchor program (Rust)
sdk/                      TS client — PDAs, accounts, NAV/drift math, Pyth helper
scripts/                  seed · deposit · withdraw · rebalance · skew · fund · negative
keeper/ · ops/            auto-rebalance loop · hosted keeper + faucet service
app/                      Next.js dashboard
docs/                     design + deploy docs
```

## Stack

Anchor · Pyth (pull oracle) · `@solana/web3.js` + `@coral-xyz/anchor` · Next.js + wallet-adapter · Node/TS keeper.
