# Mini-Symmetry — Architecture (MVP)

How the system is wired: components, data flow, on-chain accounts, and the path each
action takes. Scope = MVP (one hardcoded basket, USDC-in, keeper rebalance). See
`PLAN.md` for the build plan and `FEATURES.md` for the feature list.

---

## 1. System overview

Four components, each with one job:

```
┌──────────────┐        ┌──────────────────────────────┐        ┌──────────────┐
│   Frontend   │ ─tx──▶ │      Solana Program           │ ◀─tx── │    Keeper    │
│  (Next.js)   │        │      mini_symmetry            │        │  (Node cron) │
│              │ ◀reads─│  Basket PDA + vault ATAs      │ ─reads─│              │
└──────┬───────┘        │  + basket token mint          │        └──────┬───────┘
       │ reads          └───────────────┬───────────────┘               │ reads
       │                                │                                │
       └────────────────────────┐      │      ┌─────────────────────────┘
                                 ▼      ▼      ▼
                          ┌──────────────────────────┐
                          │   Pyth price feeds        │  (pull oracle)
                          └──────────────────────────┘
```

| Component | Responsibility | Does NOT |
|-----------|----------------|----------|
| **Program** | Custody, mint/burn basket token, NAV math, rebalance logic, guards | Decide *when* to rebalance; talk to external DEX |
| **Keeper** | Watch drift, trigger `rebalance`, post Pyth updates, (Jupiter swaps) | Hold user funds; set policy |
| **Frontend** | Deposit/withdraw UX, show NAV + weights | Hold keys server-side; do math the chain owns |
| **Pyth** | Truth for asset prices + confidence | Push prices automatically (must be pulled) |

Design rule: **the program owns custody + rules; the keeper is just an external heartbeat;
the frontend is a thin view.** No off-chain component ever holds user funds.

---

## 2. On-chain account model

```
Program: mini_symmetry

  Basket  (PDA, seeds = ["basket"])
  ├─ authority            : Pubkey        admin
  ├─ basket_mint          : Pubkey        SPL mint of the basket token (mint auth = Basket PDA)
  ├─ num_assets           : u8            (=3 for MVP)
  ├─ assets[5]            : AssetConfig   fixed array, num_assets used
  │   ├─ mint             : Pubkey        e.g. wSOL / JUP / USDC
  │   ├─ target_weight_bps: u16           5000 / 3000 / 2000  (Σ = 10000)
  │   ├─ pyth_price_feed  : Pubkey        Pyth price update account
  │   ├─ vault_ata        : Pubkey        token account holding this asset (owner = Basket PDA)
  │   └─ decimals         : u8
  ├─ rebalance_threshold_bps : u16        drift that triggers a rebalance (e.g. 100 = 1%)
  ├─ rebalance_interval_secs : i64        min seconds between rebalances
  ├─ last_rebalance_ts       : i64
  ├─ paused                  : bool
  └─ bump                    : u8

  Vault token accounts (one ATA per asset)   owner = Basket PDA → program controls balances
  Basket token mint                          mint authority = Basket PDA → program mints/burns
  User basket token ATA                      holds the user's share
```

Why a single PDA owns everything: one signer (`Basket` PDA via `invoke_signed`) controls all
asset transfers and the mint. No multisig, no off-chain custody. The vault's holdings ARE the fund.

---

## 3. Data flow per action

### 3.1 Deposit (USDC in)

```
User                Frontend            Program (deposit)            Pyth
 │  enter 10 USDC     │                       │                       │
 │───────────────────▶                        │                       │
 │                    │ build tx (+pyth upd)   │                       │
 │                    │───────────────────────▶ read prices ──────────▶│
 │                    │                        │◀──────── prices ──────│
 │                    │                        │ nav_before = Σ bal*px  │
 │                    │                        │ transfer USDC user→vault
 │                    │                        │ mint = usdc * supply / nav_before
 │                    │                        │ mint basket tokens → user
 │◀─── basket tokens ─────────────────────────│                       │
```
No swap. USDC sits idle in the vault until the next rebalance deploys it.

### 3.2 Rebalance (keeper-driven)

```
Keeper (cron, 30s)                  Program (rebalance)             Pyth
 │ fetch Basket state                    │                           │
 │ pull Pyth prices ─────────────────────────────────────────────── ▶│
 │ drift = max|cur_bps - tgt_bps|        │                           │
 │ if drift >= threshold && interval ok: │                           │
 │   build tx (pyth updates + rebalance) │                           │
 │──────────────────────────────────────▶ verify fresh + confident  │
 │                                       │ value_i, nav, target_i     │
 │                                       │ delta_i = target_i - value_i
 │                                       │ mock_swap over→under @ oracle px
 │                                       │ last_rebalance_ts = now     │
 │◀──────── confirmed ───────────────────│                           │
```
`mock` mode swaps internally at oracle price. `jupiter` mode: keeper builds Jupiter swap
ixs off-chain (mainnet), program records/settles. Same `executeSwap(from,to,amtIn)` interface.

### 3.3 Withdraw

```
User → Frontend → Program (withdraw):
   frac  = basket_amount / supply
   for each asset i: transfer floor(vault_bal_i * frac) → user
   burn basket_amount from user
```
In-kind, pro-rata, **no oracle, no swap** → atomic and un-gameable. The single safe exit.

---

## 4. Oracle integration (Pyth, pull model)

```
Pyth publishers ──▶ Pythnet ──▶ Hermes (off-chain) ──▶ keeper/frontend pull update
                                                              │
                                          price-update account posted in SAME tx
                                                              ▼
                                            program reads price + conf + publish_time
                                                              │
                                   guards: staleness (publish_time age) + confidence (conf/price)
```

- Price is only on-chain **when pulled** → every `deposit`/`rebalance` tx bundles a Pyth
  update instruction before the program instruction.
- Program **never trusts** a price that is stale (> N secs) or low-confidence (conf/price > X bps).
- Client lib: `@pythnetwork/pyth-solana-receiver`; on-chain: `pyth-solana-receiver-sdk`.

---

## 5. Swap layer (the abstraction)

One interface, two implementations, chosen by `SWAP_MODE`:

```
executeSwap(fromMint, toMint, amountIn) ─┬─ mock     → on-chain mock_swap ix, fills at Pyth ratio (devnet)
                                         └─ jupiter  → keeper hits Jupiter v6 quote+swap (mainnet)
```

Rationale: **Jupiter has no devnet liquidity.** `mock` unblocks the full loop on devnet;
`jupiter` is a drop-in for a real-DEX demo. Swaps live ONLY in the rebalance path, never in
deposit/withdraw — so the program needs no heavy Jupiter CPI and deposits stay atomic.

---

## 6. Trust & custody model

| Actor | Can | Cannot |
|-------|-----|--------|
| User | deposit, withdraw own share anytime (in-kind) | touch others' funds |
| Keeper | trigger rebalance within program rules | mint, withdraw, or steal — only swaps within vault toward target |
| Admin | set params, pause | bypass NAV/withdraw math |
| Program | move vault assets, mint/burn per code | act without an instruction (passive) |

Worst-case keeper compromise: attacker can force rebalances (bounded by threshold/interval),
but **cannot drain** — no instruction lets the keeper move funds out of the vault. Users always
exit via oracle-free in-kind `withdraw`.

---

## 7. Tech layers

```
┌─ Frontend ── Next.js + wallet adapter + Codama client (from IDL)
├─ Keeper ──── Node/TS, setInterval/cron, pyth client, (jupiter api)
├─ Client ──── @solana/kit, generated TS client
├─ Program ─── Anchor (Rust): Basket PDA, SPL token CPIs, pyth-receiver-sdk
├─ Oracle ──── Pyth pull (receiver sdk)
└─ Swaps ───── mock_swap (devnet) / Jupiter v6 (mainnet)
```

Testing: LiteSVM / Anchor mocha with mock Pyth accounts for the program; manual devnet for E2E.

---

## 8. Failure modes & how they're handled

| Failure | Handling |
|---------|----------|
| Pyth price stale | `rebalance`/`deposit` revert (guard); keeper logs, retries next tick |
| Pyth low confidence | reverted by guard |
| Drift < threshold | `rebalance` no-ops/errors; keeper skips |
| Interval not elapsed | reverted; keeper skips |
| Keeper down | basket drifts but stays solvent; resumes when keeper back; users can still withdraw |
| Compute-unit overflow | request extra CU; cap assets at 5 |
| Rounding | always floor in user's disfavor → supply can't over-claim vault |
