# Prism

**Self-rebalancing on-chain index funds on Solana.** Deposit one token, hold a whole basket — a keeper keeps it at target weights automatically.

> A prism splits one beam into a spectrum. Prism splits one deposit into a diversified, auto-balanced portfolio.

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.32-512BD4)](https://www.anchor-lang.com)
[![Oracle](https://img.shields.io/badge/Oracle-Pyth%20pull-6E56CF)](https://pyth.network)
[![Status](https://img.shields.io/badge/status-live%20on%20devnet-22c55e)](#live-demo)

---

## The pitch

Buying a balanced portfolio on-chain is tedious: pick the assets, size each trade, and re-do it every time prices drift. Prism turns that into **one click**.

> *"I deposit USDC. I get a single **basket token** representing SOL / JUP / BONK at target weights. Prices move, the basket drifts, a keeper bot rebalances it back to target — automatically. I withdraw anytime and get my pro-rata share of the underlying assets back."*

That full loop — **deposit → auto-rebalance → withdraw** — runs live on devnet today, with **any visitor's own wallet** and no CLI.

---

## Live demo

A persistent devnet instance anyone can test:

1. Open the dashboard, set your wallet to **Devnet**, connect.
2. Click **Get test funds** → an in-app faucet sends you devnet SOL + test USDC.
3. **Create a basket** (pick 2–4 assets + weights) or deposit into a demo basket.
4. **Deposit** USDC → the basket goes over-weight USDC → the hosted keeper rebalances it to target within seconds.
5. **Withdraw** → get the underlying assets back in-kind.

No admin access, no setup — a reviewer drives the whole protocol from the browser.

- **Program (devnet):** `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`
- **Oracle:** Pyth (pull) — SOL/USD, JUP/USD, BONK/USD, USDC/USD

---

## What we built

### 🧺 User-created multi-asset baskets
Anyone can spin up their own index fund: pick **2–4 assets** from the on-chain allowlist, set target weights (basis points, must sum to 100%), choose a quote asset, and set the rebalance threshold + interval. Multiple baskets run side by side.

### 💰 NAV-priced deposits
Deposit the quote asset (USDC). The program prices the vault at live **net asset value** via Pyth and mints you a basket token for your fair share. First deposit bootstraps the token at ≈ $1. No swap on deposit — funds get deployed on the next rebalance.

### 🚪 In-kind, oracle-free withdrawals
Burn basket tokens → receive your **pro-rata slice of every asset** the vault holds. No oracle, no swap, fully atomic. This is the one path users always exit through, and it **can't be price-gamed**.

### ⚖️ Auto-rebalancing keeper
An off-chain keeper polls each basket's drift. When drift ≥ threshold *and* the min interval has elapsed, it posts fresh Pyth prices and fires `rebalance`, which swaps over-weight → under-weight assets at the oracle price back to target. Idle deposited USDC gets deployed here.

### 📡 Pyth pull-oracle with guards
Every priced instruction bundles a fresh Pyth price update in the same transaction. The program **rejects** prices that are stale (> 120s), low-confidence (> 2%), wrong feed id, or not owned by the Pyth receiver. NAV math runs in micro-USD and **always floors in the vault's favor** so supply can never over-claim holdings.

### 🗂️ On-chain registry (no `getProgramAccounts`)
Baskets and the supported-asset allowlist live in an on-chain **registry** read via `getAccountInfo` / `getMultipleAccounts`. Discovery never needs `getProgramAccounts` — which public/forked RPCs throttle or don't serve — so the dashboard and keeper work on flaky devnet RPCs and even local `surfpool`.

### 🚰 Self-serve faucet + hosted ops
A single Dockerized **ops service** runs the keeper *and* a rate-limited faucet (devnet SOL + test USDC, per-pubkey + per-IP cooldown). That's what makes the public, zero-setup demo possible.

### 📊 Live multi-basket dashboard
Next.js + wallet adapter. Browse all baskets, see allocation rings, **current vs target weights**, drift badges, NAV, basket-token price, and your balance + USD value — updating live as the keeper works. Create / deposit / withdraw inline.

### ✅ Negative tests for every guard
A test suite that proves each guard **rejects** as designed (stale price, low confidence, paused basket, drift-below-threshold, interval-not-elapsed, bad weights, non-allowlisted asset, zero-mint, etc.) — not just that the happy path works.

---

## How it works

```
┌──────────────┐        ┌──────────────────────────────┐        ┌──────────────┐
│   Dashboard  │ ─tx──▶ │      Solana program (Prism)   │ ◀─tx── │  Keeper bot  │
│  (Next.js)   │        │  Registry + Basket PDAs       │        │  (Node cron) │
│   + faucet   │ ◀reads─│  + vaults + basket-token mint │ ─reads─│              │
└──────┬───────┘        └───────────────┬───────────────┘        └──────┬───────┘
       │ reads                          │                                │ reads
       └────────────────────────┐       │       ┌────────────────────────┘
                                 ▼       ▼       ▼
                          ┌──────────────────────────┐
                          │   Pyth price feeds (pull) │
                          └──────────────────────────┘
```

| Component | Owns | Never does |
|-----------|------|------------|
| **Program** | Custody, mint/burn, NAV math, rebalance logic, all guards | Decide *when* to rebalance; hold off-chain keys |
| **Keeper** | Watch drift, trigger `rebalance`, post Pyth updates | Hold user funds; mint or withdraw — it can only swap *within* a vault toward target |
| **Dashboard** | Deposit/withdraw/create UX, live view, faucet | Hold keys server-side; do math the chain owns |
| **Pyth** | Asset prices + confidence | Push automatically (must be pulled per tx) |

**Design rule:** the program owns custody and rules; the keeper is just an external heartbeat; the frontend is a thin view. **No off-chain component ever holds user funds.**

### The loop

```
  USDC                                              ┌── Pyth prices ──┐
 user ──deposit──▶ mint basket token by NAV ──▶ user │                 │
                          │ funds sit in vault        ▼                 │
                   ┌──────┴───────┐   drift vs target  keeper (cron) ───┘
                   │  vault (PDA) │◀── rebalance @ oracle px ──┘
                   └──────┬───────┘
                          │ burn token, return pro-rata assets
 user ◀──withdraw── in-kind slice of every holding
```

---

## On-chain program

Anchor (Rust). One program, instructions:

| Instruction | Who | What |
|-------------|-----|------|
| `init_registry` | admin | one-time: create the registry PDA |
| `set_supported_asset` | admin | manage the asset allowlist (mint, feed id, decimals, quote-eligible) |
| `create_basket` | anyone | new basket: 2–4 allowlisted assets, target weights (Σ = 10000 bps), quote asset, threshold, interval |
| `deposit` | user | quote asset in → mint basket token by NAV (`nav_before`) |
| `withdraw` | user | burn → in-kind pro-rata of every asset (oracle-free, atomic) |
| `rebalance` | keeper | drift ≥ threshold + interval elapsed → swap toward target at Pyth price |
| `set_params` | owner | set rebalance threshold + interval |
| `set_paused` | owner | pause / unpause a basket |

**Accounts:** a `Registry` PDA (allowlist + basket list), one `Basket` PDA per fund (config + state), one vault token account per asset (owner = Basket PDA), and a basket-token SPL mint (mint authority = Basket PDA). One PDA signer controls every transfer and the mint — no multisig, no off-chain custody. **The vault's holdings *are* the fund.**

**Guards (each has a negative test):** asset count 2–4 · weights sum to 10000 · no duplicate assets · asset must be allowlisted · quote asset must be quote-eligible · Pyth staleness ≤ 120s · Pyth confidence ≤ 2% · feed-id match · price account owned by Pyth receiver · no duplicate price accounts · pause switch · drift threshold · rebalance interval · math-overflow checks · floors favor the vault.

---

## Trust & custody

| Actor | Can | Cannot |
|-------|-----|--------|
| User | deposit, withdraw own share anytime (in-kind) | touch others' funds |
| Keeper | trigger `rebalance` within program rules | mint, withdraw, or steal — only swaps within a vault toward target |
| Owner | set a basket's params, pause it | bypass NAV / withdraw math |
| Program | move vault assets + mint/burn per code | act without an instruction (it's passive) |

**Worst-case keeper compromise:** an attacker can force rebalances (bounded by threshold + interval) but **cannot drain** — no instruction lets the keeper move funds out of a vault. Users always exit via the oracle-free in-kind `withdraw`.

---

## Project structure

```
programs/mini_symmetry/   Anchor program (Rust) — registry, baskets, deposit/withdraw/rebalance, guards
sdk/                      TypeScript client — PDAs, accounts, NAV/drift math, Pyth pull helper
scripts/                  seed · deposit · withdraw · rebalance · skew · show · negative · faucet
keeper/                   the auto-rebalance cron loop
ops/                      Dockerized hosted service: keeper + faucet (the public demo backend)
app/                      Next.js dashboard (wallet adapter, live multi-basket view)
tests/                    NAV/rounding math + guard tests
landing/                  marketing landing page
```

---

## Run it locally

Local validator via [surfpool](https://github.com/txtx/surfpool) (forks mainnet so real Pyth feeds exist):

```sh
# 1. local validator forking mainnet, on :8899
surfpool start -u https://api.mainnet-beta.solana.com -p 8899 --no-tui &

# 2. fund admin, deploy the program
solana airdrop 100 <ADMIN_PUBKEY> --url http://127.0.0.1:8899
cargo build-sbf --manifest-path programs/mini_symmetry/Cargo.toml
solana program deploy target/deploy/mini_symmetry.so \
  --program-id target/deploy/mini_symmetry-keypair.json \
  --keypair .keys/admin.json --url http://127.0.0.1:8899

# 3. seed registry, allowlist, test mints, demo baskets, keeper reserves
export RPC_URL=http://127.0.0.1:8899
pnpm run seed
pnpm run show                          # sanity: list baskets

# 4. start keeper + faucet, point the app at them
pnpm run ops &                         # keeper + faucet on :8080
RPC_URL=$RPC_URL FAUCET_URL=http://127.0.0.1:8080 pnpm run app:env

# 5. dashboard
cd app && pnpm dev                     # http://localhost:3001
```

Handy scripts: `pnpm run skew` forces drift on demand (for demos), `pnpm run negative` runs the guard-rejection suite, `pnpm test` runs the math unit tests. Full devnet deploy steps live in [`docs/DEPLOY.md`](./docs/DEPLOY.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Program | Anchor 0.32 (Rust), Pyth price-update parsing |
| Oracle | Pyth pull — `@pythnetwork/pyth-solana-receiver` + Hermes client |
| Client / scripts | `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`, `tsx` |
| Keeper + ops | Node/TS cron, Docker (Railway / Fly / Render) |
| Frontend | Next.js 14, `@solana/wallet-adapter`, Vercel |

---

## What's next

**Near term — harden the swap path**
- Real DEX execution: keeper routes rebalance swaps through **Jupiter v6** on mainnet behind the same `executeSwap(from, to, amountIn)` interface that `mock_swap` uses on devnet. Add **slippage caps** and a **circuit breaker**.
- Hardened keeper: retries, per-basket scheduling, multi-basket batching.

**Product**
- **Management / creator fees** — basket creators earn a configurable cut.
- **Analytics** — historical NAV chart, holder count, volume, fee-based APR.
- More assets per basket and a richer allowlist.

**Decentralization — the real magic**
- **Permissionless keeper network** — anyone runs a keeper, paid by **bounties**, racing to execute rebalances.
- **Oracle-spread rebalancing** — expose oracle-priced swaps so **arbitrageurs rebalance the fund for free**, dropping the DEX dependency entirely.
- **Fund-as-liquidity-provider** — baskets market-make on aggregators, earning **swap fees for holders** — rebalancing becomes profitable, not just free.
- **Intents** — conditional triggers ("if SOL > $300, trim 10%"), scheduled rebalances, DCA, volatility pauses.

**Production**
- Mainnet-beta with real funds, external audit pass, partial-fill / atomicity hardening.

---

## Known limitations (today)

- **Centralized keeper** (single keypair) — permissionless network is on the roadmap.
- **`mock_swap`** fills at the oracle price against a pre-funded reserve (Jupiter has no devnet liquidity). The same interface routes to Jupiter on mainnet.
- **Devnet only** — not yet hardened or audited for real funds.

---

*Built for Solana devnet. Deposit one token, hold a whole basket — balanced for you.*
