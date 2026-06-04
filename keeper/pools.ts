import { BN } from "@coral-xyz/anchor";
import { type Connection, type Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { pk, type PoolsConfig } from "../sdk/src/config.js";
import { latestPricesMicro } from "../sdk/src/pyth.js";
import { loadRaydium, getPoolRpc, buildCpmmSwapIxs } from "../sdk/src/raydium.js";
import type { OnchainBasket } from "../sdk/src/baskets.js";

// Self-healing liquidity: the keeper rebalances funds by swapping against shallow devnet
// CPMM pools, which drift off-oracle over time → the program's oracle-bounded swap then
// reverts with ExceededSlippage. This arbs each in-use pool back to the Pyth price (admin
// is mint authority + LP), exactly like scripts/rebalance-pools.ts but sourcing the asset
// map from on-chain baskets (the container has no .keys/basket.json).
const TRIGGER = 0.005; // only arb a pool once it's >0.5% off oracle
const TOL = 0.002; // ...then bring it back within 0.2%
const MAX_ITERS = 8;

interface AssetMeta {
  feed: string;
  decimals: number;
}

/** mint → {feed, decimals} for every asset in a live basket, plus the quote mint set. */
function assetMap(baskets: OnchainBasket[]): { meta: Map<string, AssetMeta>; quotes: Set<string> } {
  const meta = new Map<string, AssetMeta>();
  const quotes = new Set<string>();
  for (const b of baskets) {
    b.assets.forEach((a, i) => {
      meta.set(a.mint, { feed: a.feed, decimals: a.decimals });
      if (i === b.quoteIndex) quotes.add(a.mint);
    });
  }
  return { meta, quotes };
}

async function fund(conn: Connection, admin: Keypair, mint: string, whole: number, decimals: number): Promise<void> {
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, pk(mint), admin.publicKey);
  await mintTo(conn, admin, pk(mint), ata.address, admin, BigInt(Math.ceil(whole)) * 10n ** BigInt(decimals));
}

/** Re-peg every pool whose asset is held by a live basket back to its Pyth oracle price.
 *  Best-effort + isolated: a failure on one pool never throws to the caller. */
export async function rearbPools(
  conn: Connection,
  admin: Keypair,
  baskets: OnchainBasket[],
  pools: PoolsConfig,
): Promise<{ checked: number; fixed: number }> {
  if (!pools.cpmmProgram || Object.keys(pools.pools).length === 0) return { checked: 0, fixed: 0 };
  const { meta, quotes } = assetMap(baskets);
  const raydium = await loadRaydium(conn, admin);
  let checked = 0;
  let fixed = 0;

  for (const [poolKey, pool] of Object.entries(pools.pools)) {
    // Identify quote (usdc) + asset side; skip pools whose asset isn't in any live basket.
    const quoteMint = quotes.has(pool.token0Mint) ? pool.token0Mint : quotes.has(pool.token1Mint) ? pool.token1Mint : null;
    if (!quoteMint) continue;
    const assetMint = pool.token0Mint === quoteMint ? pool.token1Mint : pool.token0Mint;
    const am = meta.get(assetMint);
    const qm = meta.get(quoteMint);
    if (!am || !qm) continue;

    try {
      checked++;
      const oracle = (await latestPricesMicro([am.feed]))[am.feed]! / 1e6; // usd per whole asset
      if (!(oracle > 0)) continue;

      for (let iter = 0; iter < MAX_ITERS; iter++) {
        const { poolInfo, rpcData } = await getPoolRpc(raydium, pool.poolId);
        const quoteIsA = poolInfo.mintA.address === quoteMint;
        const quoteRes = Number(quoteIsA ? rpcData.baseReserve : rpcData.quoteReserve);
        const assetRes = Number(quoteIsA ? rpcData.quoteReserve : rpcData.baseReserve);
        const decA = am.decimals;
        const decQ = qm.decimals;

        const spot = quoteRes / 10 ** decQ / (assetRes / 10 ** decA); // usd per whole asset
        const off = spot / oracle - 1;
        // First pass only acts when meaningfully off; later passes converge to TOL.
        if (Math.abs(off) <= (iter === 0 ? TRIGGER : TOL)) {
          if (iter > 0) fixed++;
          break;
        }

        // constant-product target reserves at oracle (raw units)
        const k = quoteRes * assetRes;
        const oracleRaw = oracle * 10 ** (decQ - decA); // quote-raw per asset-raw
        const assetTarget = Math.sqrt(k / oracleRaw);
        const quoteTarget = Math.sqrt(k * oracleRaw);

        let inputMint: string, amountRaw: number, inDecimals: number;
        if (assetTarget > assetRes) {
          inputMint = assetMint;
          amountRaw = assetTarget - assetRes;
          inDecimals = decA;
        } else {
          inputMint = quoteMint;
          amountRaw = quoteTarget - quoteRes;
          inDecimals = decQ;
        }
        if (!(amountRaw > 0)) break;
        const whole = amountRaw / 10 ** inDecimals;

        await fund(conn, admin, inputMint, whole * 1.05 + 1, inDecimals); // ensure admin holds it
        const { ixs } = await buildCpmmSwapIxs(raydium, pool.poolId, inputMint, new BN(Math.round(amountRaw)), 500);
        await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [admin], { commitment: "confirmed" });
        console.log(`  pool ${poolKey}: ${(off * 100).toFixed(2)}% off → arbed`);
      }
    } catch (e) {
      console.warn(`  pool ${poolKey} re-arb skipped:`, (e as Error).message);
    }
  }
  return { checked, fixed };
}
