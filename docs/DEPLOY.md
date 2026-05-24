# Deploy — public devnet demo (anyone can test)

The goal: a persistent devnet instance where a visitor connects a wallet holding test
USDC, creates/deposits into a basket, and watches the hosted keeper auto-rebalance it.

Three things run: the **program** (devnet), the **ops service** (the keeper, one
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

## 3. Ops service — the keeper (Railway / Fly / Render)
Build context is the repo root; the image is `ops/Dockerfile`.
```sh
docker build -f ops/Dockerfile -t mini-symmetry-ops .
```
Set these env vars on the host:
| var | value |
|-----|-------|
| `RPC_URL` | your devnet RPC (`$RPC`) |
| `ADMIN_SECRET_KEY` | the admin secret key as a JSON array (mint authority + keeper) |
| `KEEPER_POLL_MS` | `7000` |

Health check: `GET /health` → `{"ok":true}`.

## 4. Dashboard (Vercel)
- **Root Directory = `app`** (Vercel project setting).
- Env:
  - `NEXT_PUBLIC_RPC_URL` = `$RPC`
  - `NEXT_PUBLIC_PROGRAM_ID` = `8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe`
  - `NEXT_PUBLIC_MINTS` = the `mints` object from `.keys/basket.json` (compact JSON)
- `RPC_URL=$RPC pnpm run app:env` prints these into `app/.env.local` if you prefer to copy them.

## 5. Security / hardening
- **Move the program upgrade authority to a cold key** after the final deploy, so the
  hot ops key (which mints test USDC + signs the keeper) can't brick the program:
  ```sh
  solana program set-upgrade-authority 8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe \
    --new-upgrade-authority <COLD_PUBKEY> --keypair .keys/admin.json --url $RPC
  ```

## What a reviewer does
1. Open the Vercel URL. Set Phantom to **Devnet** (or your custom RPC), connect a wallet
   that holds the test USDC mint (the admin wallet does; or send some test USDC to yours).
2. **Create a basket** (pick 2–4 assets + weights) — or pick a demo basket.
3. **Deposit** USDC → the basket goes over-weight USDC → the hosted keeper rebalances
   it to target within a few seconds. **Withdraw** returns the assets in-kind.

## Local dev (surfpool)
```sh
surfpool start -u https://api.mainnet-beta.solana.com -p 8899 --no-tui &
solana airdrop 100 Ea8PXNo7… --url http://127.0.0.1:8899
solana program deploy … --url http://127.0.0.1:8899
export RPC_URL=http://127.0.0.1:8899
pnpm run seed
pnpm run ops &                       # keeper + /health on :8080
RPC_URL=$RPC_URL pnpm run app:env
cd app && pnpm dev                    # http://localhost:3001
```
Surfpool does **not** serve getProgramAccounts — the registry design is what makes the
keeper + dashboard work there (and on throttled devnet RPCs) anyway.
