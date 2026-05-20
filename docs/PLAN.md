# Mini-Symmetry — Plan

A minimal on-chain index-fund / basket protocol on Solana, inspired by [Symmetry.fi](https://symmetry.fi).
Deposit USDC, get one token representing a multi-asset basket, and a keeper auto-rebalances
the basket back to its target weights using oracle prices.

> **Scope decisions (locked):** hackathon/demo build · Jupiter for swaps · fresh repo ·
> "USDC in, auto-split" deposit UX · this doc is the deliverable before any code.

---

## 1. What we are building (the demo story)

> "I deposit 10 USDC. I receive a **basket token** that represents a portfolio of
> SOL / JUP / USDC at target weights 50 / 30 / 20. Prices move, the basket drifts off
> target, a keeper bot automatically rebalances it back. I withdraw and get my
> pro-rata share of the underlying assets."

That single end-to-end loop **is** the MVP. Everything else is later.

### The loop

```
                ┌──────────── Pyth oracle (prices) ────────────┐
                │                                               │
   USDC   ┌─────▼─────┐   mint basket token   ┌──────────┐     │
 user ───▶│  deposit  │──────────────────────▶│   user   │     │
          └─────┬─────┘                        └──────────┘     │
                │ USDC sits in vault                            │
          ┌─────▼─────┐   reads drift vs target   ┌──────────┐ │
          │   vault   │◀──────────────────────────│  keeper  │─┘
          │  (PDA)    │   swaps to hit weights     │  (cron)  │
          └─────┬─────┘   via Jupiter             └──────────┘
                │ burn basket token, return pro-rata assets
          ┌─────▼─────┐
          │ withdraw  │──▶ user gets SOL/JUP/USDC back
          └───────────┘
```

---

## 2. Scope

### In (MVP / Phase 1)
- One **hardcoded** basket: SOL 50% / JUP 30% / USDC 20% (weights in basis points).
- `deposit` — user sends USDC, receives basket tokens priced by NAV.
- `withdraw` — burn basket tokens, receive **in-kind pro-rata** slice of every holding.
- NAV pricing from **Pyth** (with staleness + confidence checks).
- `rebalance` instruction — swaps vault holdings back toward target weights.
- One **keeper** cron (Node/TS) that polls drift and calls `rebalance`.
- Minimal **frontend** (Next.js): connect wallet, deposit, withdraw, live NAV + weights.

### Out (explicitly NOT in MVP)
- ❌ User-created / multiple baskets
- ❌ Permissionless keeper network + bounties
- ❌ Dutch auctions
- ❌ Intents (limit orders, conditional triggers, scheduled rebalance)
- ❌ Fund-as-liquidity-provider (earning LP fees)
- ❌ Management / performance fees
- ❌ > 5 assets, stocks, RWAs
- ❌ Mainnet production hardening / audit

---

## 3. The hard part: swaps. Jupiter ≠ devnet.

**Jupiter has essentially no liquidity / routes on devnet.** This is the single biggest
architectural constraint and it drives two decisions below.

### Decision A — keep swaps OUT of `deposit`/`withdraw`
- `deposit` does **not** swap. It takes USDC, prices the vault via NAV, mints basket
  tokens, and lets the USDC sit idle in the vault.
- The keeper's `rebalance` is the **only** place that swaps. Idle USDC naturally gets
  deployed into the basket assets during rebalance (under-weight → buy).
- `withdraw` returns assets **in-kind** (pro-rata of each token the vault holds) — also
  **no swap**, fully atomic.

This means: the program never has to do a Jupiter CPI. Swaps happen only in the keeper,
off-chain-built and submitted. Massively simpler, fewer accounts, atomic where it counts.
The "auto-split" the user expects happens via the keeper's first rebalance after deposit.

### Decision B — how to actually swap for the demo
Pick one (documented as a config flag `SWAP_MODE`):

| Mode | How | Trade-off | Use when |
|------|-----|-----------|----------|
| **`mock`** (recommended for devnet demo) | A `mock_swap` instruction swaps token A→B at the **Pyth oracle price** out of a pre-funded vault. No external DEX. | Not "real" Jupiter, but deterministic + works offline on devnet. | Safe, repeatable demo. |
| **`jupiter`** | Keeper calls Jupiter v6 quote+swap API on **mainnet-beta** with tiny amounts. | Real, but costs real money + mainnet risk. | Want to show real DEX integration. |

**Recommendation:** build `mock` first (unblocks the whole loop on devnet), wire `jupiter`
behind the same interface as a stretch. Both implement one keeper-side function
`executeSwap(from, to, amountIn)`.

---

## 4. On-chain program (Anchor, Rust)

Program name: `mini_symmetry`. Single basket for MVP.

### 4.1 Accounts / PDAs

```
Basket (PDA, seeds = ["basket"])          // the fund config + state
  authority: Pubkey                        // admin (can update params)
  basket_mint: Pubkey                      // SPL mint of the basket token (program-owned)
  num_assets: u8
  assets: [AssetConfig; 5]                  // fixed-size, use num_assets entries
  rebalance_threshold_bps: u16             // e.g. 100 = 1% drift triggers
  rebalance_interval_secs: i64             // min seconds between rebalances
  last_rebalance_ts: i64
  paused: bool
  bump: u8

AssetConfig
  mint: Pubkey                             // SPL mint of the asset (e.g. wSOL, JUP, USDC)
  target_weight_bps: u16                   // 5000 / 3000 / 2000  (sum must = 10000)
  pyth_price_feed: Pubkey                  // Pyth price update account for this asset
  vault_ata: Pubkey                        // basket's token account holding this asset
  decimals: u8

basket_mint authority = Basket PDA         // program mints/burns basket tokens
vault ATAs owner      = Basket PDA         // program controls all asset balances
```

### 4.2 Instructions

```
initialize_basket(params)
  - admin only, once
  - create basket_mint (decimals = 6), create vault ATA per asset
  - set weights, threshold, interval, pyth feeds

deposit(usdc_amount)
  - transfer usdc_amount USDC: user → vault USDC ATA
  - nav_usd = Σ (vault_balance[i] * pyth_price[i])      // BEFORE this deposit's USDC? see §5
  - if supply == 0:  mint_amount = usdc_amount (1:1 bootstrap, basket token ≈ $1)
    else:            mint_amount = usdc_value_deposited * supply / nav_usd_before
  - mint mint_amount basket tokens → user
  - emit Deposit event

withdraw(basket_amount)
  - frac = basket_amount / basket_supply
  - for each asset i: transfer floor(vault_balance[i] * frac) → user
  - burn basket_amount basket tokens from user
  - emit Withdraw event
  - (in-kind, no swap, no oracle needed → cannot be gamed by oracle)

rebalance()                                // called by keeper
  - require !paused
  - require now - last_rebalance_ts >= rebalance_interval_secs
  - read all pyth prices (fresh + within confidence)
  - compute nav, current weight_bps[i] = value[i]/nav
  - find max drift = max|current_bps[i] - target_bps[i]|
  - require max_drift >= rebalance_threshold_bps   // else no-op / error
  - compute trades: over-weight assets sell, under-weight buy, sized to hit target
  - SWAP_MODE=mock: do mock_swap CPI(s) at oracle price
    SWAP_MODE=jupiter: this ix only records intent; keeper does Jupiter swap then calls settle
  - set last_rebalance_ts = now
  - emit Rebalance event

mock_swap(from_mint, to_mint, amount_in)   // only compiled in mock mode
  - price both via pyth, transfer out from_mint, transfer in to_mint at oracle ratio
  - (vault-internal; simulates a 0-slippage DEX fill)

admin: set_params(threshold, interval), set_paused(bool)
```

### 4.3 Guards (even for a demo, do these)
- **Pyth staleness**: reject if `price.publish_time` older than N secs (e.g. 60).
- **Pyth confidence**: reject if `conf / price > max_conf_bps` (e.g. 2%).
- **Weight sum**: target weights must sum to 10000 bps on init.
- **Pause switch**: admin can halt deposit/rebalance.
- **Withdraw is oracle-free** (in-kind) → the one path users exit through can't be oracle-gamed.

---

## 5. Math (get this right)

All USD values use Pyth price scaled to a common precision (work in 1e6 "micro-USD").

```
value_i      = vault_balance_i * price_i / 10^decimals_i      // micro-USD
nav_usd      = Σ value_i
nav_per_tok  = nav_usd / basket_supply                         // basket token price

deposit mint:
  usdc_value = usdc_amount                                     // USDC ~ $1, 6 decimals
  if supply == 0: mint = usdc_value                            // bootstrap 1 token ≈ $1
  else:           mint = usdc_value * supply / nav_usd_before  // BEFORE adding the new USDC

withdraw:
  frac   = basket_amount / supply
  out_i  = floor(vault_balance_i * frac)

rebalance target amounts:
  target_value_i = nav_usd * target_bps_i / 10000
  delta_value_i  = target_value_i - value_i      // >0 buy, <0 sell
  delta_amount_i = delta_value_i * 10^decimals_i / price_i
```

> **Ordering trap:** in `deposit`, compute `nav_usd_before` from balances *before* crediting
> the new USDC (or subtract the just-deposited USDC), else the depositor mints against their
> own money and dilutes incorrectly. Decide one convention and unit-test it.

> **Rounding:** always round *mint* down and *withdraw out* down (favor the vault) so supply
> can never claim more than vault holds.

---

## 6. Keeper (Node/TS cron)

```
every 30s:
  basket = fetchBasketState()
  prices = pullPyth(basket.assets)            // build price-update accounts
  drift  = computeMaxDrift(basket, prices)
  if drift >= basket.threshold
     && now - basket.last_rebalance >= basket.interval:
        tx = buildRebalanceTx(basket, prices)  // includes Pyth update ixs
        (jupiter mode: build Jupiter swap ixs here)
        sign(keeperKeypair) + send + confirm
  log drift, action
```

- Single keypair, you run it. **Centralized — flag this as a known demo limitation.**
- Pyth is **pull** based: keeper must post price-update accounts in the same tx
  (`@pythnetwork/pyth-solana-receiver`).
- Idempotent: if `rebalance` reverts (drift < threshold, interval not elapsed), keeper logs and moves on.

---

## 7. Frontend (Next.js, minimal)

- Wallet connect (`@solana/wallet-adapter` or framework-kit).
- **Deposit** box: input USDC amount → `deposit`.
- **Withdraw** box: input basket-token amount → `withdraw`.
- **Dashboard**: NAV, basket-token price, **current weights vs target** (bar per asset),
  drift %, last rebalance time, your basket-token balance + USD value.
- Live refresh (poll RPC or websocket on account change).

No fancy design. Numbers + bars that visibly move = the demo.

---

## 8. Tech stack

| Layer | Choice |
|-------|--------|
| Program | Anchor (Rust), Solana |
| Oracle | Pyth (`pyth-solana-receiver-sdk` on-chain, `@pythnetwork/pyth-solana-receiver` client) |
| Swaps | `mock_swap` (devnet) / Jupiter v6 API (mainnet stretch) |
| Client | `@solana/kit` (or web3.js), Codama-generated client from IDL |
| Keeper | Node + TS, plain cron / `setInterval` |
| Frontend | Next.js + wallet adapter |
| Test | LiteSVM / Anchor mocha for program; manual devnet for E2E |

---

## 9. Build order (≈1 week)

| Day | Deliverable | Done when |
|-----|-------------|-----------|
| 1 | Anchor scaffold, `Basket` PDA, `initialize_basket`, basket mint | `anchor test` inits a basket on LiteSVM |
| 2 | `deposit` + `withdraw` (USDC-only, no other assets yet) | mint/burn math passes unit tests, rounding favors vault |
| 3 | Pyth NAV pricing + staleness/confidence guards | NAV computed from mock Pyth accounts in tests |
| 4 | `mock_swap` + `rebalance` (drift calc, target trades) | rebalance drives weights to target in a test |
| 5 | Keeper cron: poll drift → call rebalance on devnet | bot auto-rebalances a live devnet basket |
| 6 | Frontend: deposit / withdraw / NAV / weights bars | full loop clickable in browser on devnet |
| 7 | Devnet seed script, demo polish, record walkthrough | one-command setup + clean demo video |

---

## 10. Acceptance criteria (MVP done)

- [ ] Deposit USDC on devnet → receive basket tokens priced by NAV.
- [ ] Dashboard shows weights drifting as prices move.
- [ ] Keeper auto-rebalances when drift > threshold; change visible on dashboard.
- [ ] Withdraw → receive pro-rata assets back; basket supply burns correctly.
- [ ] Pyth staleness/confidence guards reject bad prices (demonstrate with a forced stale feed).
- [ ] One-command devnet seed + a recorded end-to-end demo.

---

## 11. Risks & gotchas (known going in)

- **Jupiter/devnet liquidity** → solved via `mock_swap` (§3). Don't discover this on day 5.
- **Pyth pull model** → must post price updates per tx; budget compute units.
- **NAV ordering bug** in deposit (§5) → unit-test the dilution math first.
- **Rounding** → always favor the vault; never let supply over-claim.
- **Atomicity** → keeping swaps in the keeper (not deposit) avoids partial-fill mid-deposit.
- **Centralized keeper** → fine for demo, label it; permissionless is Phase 4.
- **Compute limits** → 5 assets × Pyth reads × swaps can hit CU caps; may need `requestUnits`.

---

## 12. Phases after MVP (roadmap, not now)

- **Phase 2 — usable:** user-created baskets, per-basket params, multiple baskets, basic fee, hardened keeper.
- **Phase 3 — credible:** mainnet-beta, slippage caps, audit pass, NAV history + APR analytics.
- **Phase 4 — the real magic:** oracle-spread rebalance (arbs do it free, drop Jupiter dependency),
  permissionless keeper network + bounties, intents, fund-as-LP earning fees for holders.
