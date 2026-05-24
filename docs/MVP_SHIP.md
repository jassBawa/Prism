# Prism — Path to Ship (MVP)

Living checklist for shipping the MVP. Tracks the gates from "code written" to
"mainnet-ready", what's ticked, and what's left. Updated as work lands.

**Scope of this MVP phase:** spread-incentivized **permissionless rebalance** + **dual
drift gate** (abs + rel) + **creator deposit fee**, on top of the existing
deposit → rebalance → withdraw loop. Devnet, mock swaps, single reference keeper.

Last updated: 2026-06-01.

---

## Gate status

| Gate                                  | State         | Evidence                                                           |
| ------------------------------------- | ------------- | ------------------------------------------------------------------ |
| Program compiles (SBF)                | ✅            | `anchor build` clean                                               |
| Off-chain math unit tests             | ✅            | `pnpm test` → 11 pass (NAV, drift, dual gate, fee split)           |
| **On-chain contract tests (LiteSVM)** | ✅            | `pnpm test` → 8 pass, every instruction + guard, mocked Pyth       |
| Local validator E2E (surfpool)        | ✅            | deposit · rebalance · withdraw · negative all green on `:8899` |
| Devnet E2E                            | ✅            | in-place upgrade + reseed + full loop on `8TrJeQ…`                 |
| Typecheck (root + app)                | ✅            | `pnpm typecheck` + `app` tsc clean                                 |
| Docs                                  | ✅            | README · ARCHITECTURE · FEATURES · SHIP updated                    |
| **Smart-contract sign-off**           | ✅ **TICKED** | see below                                                          |
| Mainnet hardening                     | ⬜            | see "Path to mainnet"                                              |

---

## Smart-contract sign-off ✅

All instructions and guards are exercised by the LiteSVM suite
(`tests/contract.litesvm.test.ts`) against the built `.so`, with deterministic mocked
Pyth price accounts and clock — **fully local, no validator, no network** — and again
end-to-end on surfpool + devnet.

**Coverage (every instruction):**

| Instruction           |                           Happy path                            | Guards verified                                                                     |
| --------------------- | :-------------------------------------------------------------: | ----------------------------------------------------------------------------------- |
| `init_registry`       |                               ✅                                | non-admin → `Unauthorized`                                                          |
| `set_supported_asset` |                         ✅ (bootstrap)                          | admin-gated                                                                         |
| `create_basket`       |                               ✅                                | `BadWeights`, `BadParams` (fee>5%, spread>1%), `QuoteNotEligible`, `DuplicateAsset` |
| `deposit`             |      ✅ NAV mint + **exact fee split** (creator≠depositor)      | `ZeroAmount`, `StalePrice`, `LowConfidence`, `Paused`                               |
| `withdraw`            |             ✅ exact pro-rata in-kind, supply burn              | `BadAmount` (>supply), `ZeroAmount`                                                 |
| `rebalance`           | ✅ **permissionless** caller profits the spread, vault → target | **dual gate** abs-pass/rel-fail → `DriftBelowThreshold`, `IntervalNotElapsed`       |
| `set_params`          |                    ✅ all 5 fields persisted                    | non-authority → `Unauthorized`                                                      |
| `set_paused`          |                        ✅ halts deposit                         | —                                                                                   |

**Key invariants asserted:**

- Deposit fee: `fee = floor(mint·feeBps/1e4)` to creator, `mint−fee` to depositor, total supply = full mint; tiny deposit → fee floors to 0.
- Spread: a non-keeper arb's reserve value strictly increases after rebalance; vault lands within 1% of target weights.
- Dual gate: an asset breaching abs but not rel does **not** trigger (rel ≥ abs always, so the rel gate is the binding one when set higher).
- Pyth: staleness (>60s) and confidence (>2%) both reject.

**Issues found & fixed during sign-off:**

1. **Resilient-decode coder name** — `fetchAllBaskets` (sdk + app) used `coder.accounts.decode("Basket", …)`; anchor 0.32 keys it lowercase (`"basket"`). The wrong name threw on every account → would have silently skipped **all** baskets (empty dashboard/keeper). Caught by the LiteSVM suite, fixed in `sdk/src/baskets.ts` + `app/lib/program.ts`, re-verified on surfpool (`fetchAllBaskets` → 2 baskets).

No issues found in the on-chain program logic itself.

---

## How to run the gates

```sh
# fully local, no chain (unit + contract):
pnpm test                       # 19 tests (11 math + 8 LiteSVM contract)
pnpm typecheck                  # root; (cd app && pnpm exec tsc --noEmit) for the app

# local validator end-to-end (surfpool):
surfpool start -u https://api.mainnet-beta.solana.com -p 8899 --no-tui &
solana airdrop 100 Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ --url http://127.0.0.1:8899
solana program deploy target/deploy/mini_symmetry.so \
  --program-id target/deploy/mini_symmetry-keypair.json -k .keys/admin.json --url http://127.0.0.1:8899
export RPC_URL=http://127.0.0.1:8899
pnpm seed && pnpm deposit 100 && pnpm rebalance <BASKET> && pnpm withdraw 10 <BASKET> && pnpm negative
```

`tests/contract.litesvm.test.ts` loads `target/deploy/mini_symmetry.so` directly, so
re-run `anchor build` before the suite after any program change.

---

## Path to mainnet (remaining, not in this MVP)

1. **Real-DEX execution** — route rebalance legs through Jupiter v6 (replace `mock_swap`);
   slippage caps + circuit breaker. The `executeSwap(from,to,amtIn)` interface is the seam.
2. **Multi-source oracle** — add Raydium TWAP / a second feed + a volatility guard
   (Pyth-only today).
3. **Keeper bounty market** — pay callers a task bounty on top of the spread; scheduling/retries.
4. **Move upgrade authority to a cold key** (see `docs/DEPLOY.md` §5) after the final deploy.
5. **Audit** — internal + external review before real funds.
6. **Fee polish** — management/performance fees (high-watermark), creator fee claiming UX.

When 1–5 are done, flip "Mainnet hardening" to ✅ and cut a mainnet-beta deploy.
