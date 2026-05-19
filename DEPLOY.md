# Deploy — public devnet demo (anyone can test)

The goal: a persistent devnet instance where a visitor connects their own wallet,
clicks **Get test funds**, creates/deposits into a basket, and watches the hosted
keeper auto-rebalance it — no admin, no CLI.

Three things run: the **program** (devnet), the **ops service** (keeper + faucet, one
always-on host), and the **dashboard** (Vercel). Discovery uses an on-chain
**registry** (read via getAccountInfo + getMultipleAccounts) — never
getProgramAccounts, which public/forked RPCs throttle or don't serve.

## 0. Prereqs
- A reliable devnet RPC (public `api.devnet.solana.com` is flaky → use a free Helius
  devnet key). Call it `$RPC` below.
- `.keys/admin.json` (the mint authority + keeper signer, `Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ`).

## 1. Fund admin + deploy the program (one-time)
```sh
solana airdrop 4 Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ --url $RPC   # repeat / use a faucet; ~380 KB program needs a buffer
cargo build-sbf --manifest-path programs/mini_symmetry/Cargo.toml
solana program deploy target/deploy/mini_symmetry.so \
  --program-id target/deploy/mini_symmetry-keypair.json \
  --keypair .keys/admin.json --url $RPC          # upgrade-in-place; same id 8TrJeQ…
```

## 2. Seed (test mints, allowlist, registry, demo baskets, keeper reserves)
```sh
RPC_URL=$RPC pnpm run seed          # writes .keys/basket.json (programId, mints, baskets[])
RPC_URL=$RPC pnpm run show          # sanity: lists the baskets
```

## 3. Ops service — keeper + faucet (Railway / Fly / Render)
Build context is the repo root; the image is `ops/Dockerfile`.
```sh
docker build -f ops/Dockerfile -t mini-symmetry-ops .
```
Set these env vars on the host:
| var | value |
|-----|-------|
| `RPC_URL` | your devnet RPC (`$RPC`) |
| `ADMIN_SECRET_KEY` | the admin secret key as a JSON array (mint authority + keeper) |
| `FAUCET_USDC_MINT` | the `usdc` mint from `.keys/basket.json` → `mints.usdc` |
| `FAUCET_SOL_SECRET_KEY` | (recommended) a **separate** small SOL wallet's secret key — so a drained faucet can't starve the keeper's fees. Omit to reuse admin. |
| `ALLOW_ORIGIN` | your Vercel origin, e.g. `https://mini-symmetry.vercel.app` |
| `KEEPER_POLL_MS` | `7000` |
| `FAUCET_SOL` / `FAUCET_USDC` | per-claim amounts, e.g. `0.2` / `1000` |

Fund the **faucet SOL wallet** with devnet SOL (it sends SOL to visitors; top up as needed).
Health check: `GET /health` → `{"ok":true}`. Faucet: `POST /faucet {"pubkey":"…"}`.

## 4. Dashboard (Vercel)
- **Root Directory = `app`** (Vercel project setting).
- Env:
  - `NEXT_PUBLIC_RPC_URL` = `$RPC`
  - `NEXT_PUBLIC_PROGRAM_ID` = `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`
  - `NEXT_PUBLIC_MINTS` = the `mints` object from `.keys/basket.json` (compact JSON)
  - `NEXT_PUBLIC_FAUCET_URL` = the ops service URL (e.g. `https://…railway.app`)
- `RPC_URL=$RPC FAUCET_URL=<ops-url> pnpm run app:env` prints these into `app/.env.local`
  if you prefer to copy them.

## 5. Security / hardening
- **Move the program upgrade authority to a cold key** after the final deploy, so the
  hot ops key (which mints test USDC + signs the keeper) can't brick the program:
  ```sh
  solana program set-upgrade-authority 8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe \
    --new-upgrade-authority <COLD_PUBKEY> --keypair .keys/admin.json --url $RPC
  ```
- Faucet is rate-limited per pubkey + per IP (12 h). Test-token minting is harmless
  (play money); the only real cost is faucet SOL — keep it on the separate small wallet.

## What a reviewer does
1. Open the Vercel URL. Set Phantom to **Devnet** (or your custom RPC), connect.
2. Click **Get test funds** → gets SOL + test USDC.
3. **Create a basket** (pick 2–4 assets + weights) — or pick a demo basket.
4. **Deposit** USDC → the basket goes over-weight USDC → the hosted keeper rebalances
   it to target within a few seconds. **Withdraw** returns the assets in-kind.

## Local dev (surfpool)
```sh
surfpool start -u https://api.mainnet-beta.solana.com -p 8899 --no-tui &
solana airdrop 100 Ea8PXNo7… --url http://127.0.0.1:8899
solana program deploy … --url http://127.0.0.1:8899
export RPC_URL=http://127.0.0.1:8899
pnpm run seed
pnpm run ops &                       # keeper + faucet on :8080
RPC_URL=$RPC_URL FAUCET_URL=http://127.0.0.1:8080 pnpm run app:env
cd app && pnpm dev                    # http://localhost:3001
```
Surfpool does **not** serve getProgramAccounts — the registry design is what makes the
keeper + dashboard work there (and on throttled devnet RPCs) anyway.
