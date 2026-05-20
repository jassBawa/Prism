# Mini-Symmetry — Ship Tracker (few-hours build)

The compressed, execution-focused plan to ship the full loop. See `PLAN.md` /
`ARCHITECTURE.md` / `FEATURES.md` for the design. This doc tracks **what's done and
what's next**, with the exact commands.

> Scope locked with the user: **real Pyth on devnet** + **full stack** (program +
> tests + keeper + Next.js dashboard + devnet). One hardcoded basket SOL 50 / JUP 30 / USDC 20.

## Status

| Step | State | Proof |
|------|-------|-------|
| 1. Anchor program (init/deposit/withdraw/rebalance/mock-swap/admin) | ✅ **done** | one `lib.rs`, real Pyth via manual parse |
| 2. Build + IDL | ✅ **done** | `target/deploy/mini_symmetry.so` (323 KB) + `target/idl/mini_symmetry.json` |
| 3. Deploy to devnet | ✅ **done** | program `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`, executable on devnet |
| 4. TS client (from IDL) | ⬜ next | `@coral-xyz/anchor` + generated types |
| 5. Seed: `initialize_basket` on devnet | ⬜ next | 3 controlled test mints + Pyth feed wiring |
| 6. Keeper cron (poll drift → rebalance, post Pyth updates) | ⬜ | Node/TS `setInterval` |
| 7. Next.js dashboard (deposit/withdraw + NAV + weight bars) | ⬜ | the visible demo |
| 8. TS tests (NAV math, rounding, guards) | ⬜ | `@coral-xyz/anchor` + bankrun/litesvm-ts |
| 9. Seed script + demo recording | ⬜ | one-command setup |

## Program — what's live

Program id `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe` (devnet). Instructions:

| Ix | What |
|----|------|
| `initialize_basket(weights, feed_ids, threshold_bps, interval_secs)` | admin: create Basket PDA + basket mint + 3 vault ATAs |
| `deposit(usdc_amount)` | USDC in → mint basket token by NAV (uses `nav_before`) |
| `withdraw(basket_amount)` | burn → in-kind pro-rata of every asset (oracle-free, atomic) |
| `rebalance()` | keeper: drift ≥ threshold + interval → mock-swap vs keeper reserve at Pyth price |
| `set_params` / `set_paused` | admin controls |

Guards: Pyth staleness (≤120s) + confidence (≤2%), weight sum = 10000, pause. Math in micro-USD, floors in the vault's favor. Pyth `PriceUpdateV2` parsed manually (avoids the pyth-crate ↔ anchor-1.0 borsh conflict); price account owner must be the Pyth receiver `rec5EKMGg6…`.

## Build / deploy commands

```sh
anchor build                                  # -> target/deploy/*.so + target/idl/*.json
# deploy (paid by the funded keeper wallet, ~2.3 SOL rent):
solana program deploy target/deploy/mini_symmetry.so \
  --program-id target/deploy/mini_symmetry-keypair.json \
  --keypair ../prism/.keys/keeper.json --url devnet
```

## Next: seed plan (step 5)

To run the loop on devnet self-contained:
1. **3 controlled test mints** (we hold mint authority) for the SOL/JUP/USDC slots — lets the keeper fund the reserve + lets users get test USDC freely.
2. Tag each asset with the real Pyth **feed id** (SOL/USD, JUP/USD, USDC/USD). The program prices the test mint using that feed.
3. The **keeper posts Pyth pull updates** (Hermes → `PriceUpdateV2` accounts via `@pythnetwork/pyth-solana-receiver`) and passes those accounts into `deposit`/`rebalance`.
4. `initialize_basket` with weights 5000/3000/2000, threshold 100 bps, interval (short for demo).
5. Fund the keeper reserve ATAs (mint test tokens) so `rebalance` can mock-swap.

## Acceptance (MVP done)

- [x] Program builds + deploys to devnet
- [ ] `initialize_basket` succeeds on devnet
- [ ] Deposit USDC → receive basket tokens priced by NAV
- [ ] Keeper auto-rebalances when drift > threshold; visible on dashboard
- [ ] Withdraw → pro-rata assets back; supply burns
- [ ] Pyth staleness/confidence guard rejects a forced-stale feed
- [ ] One-command seed + recorded demo

## Known limitations (flag in the demo)

- Centralized keeper (single keypair) — permissionless is Phase 4.
- `mock_swap` fills at oracle price vs the keeper's own reserve (no real DEX; Jupiter has no devnet liquidity). Same `executeSwap` interface swaps to Jupiter on mainnet.
- One hardcoded basket; user-created baskets are Phase 2.
