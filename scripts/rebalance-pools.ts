import { BN } from "@coral-xyz/anchor";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { SUPPORTED_ASSETS } from "../sdk/src/constants.js";
import { loadBasketsConfig, loadPoolsConfig, pk } from "../sdk/src/config.js";
import { latestPricesMicro } from "../sdk/src/pyth.js";
import { loadRaydium, buildCpmmSwapIxs, getPoolRpc } from "../sdk/src/raydium.js";

// Arbitrage each CPMM pool back to the Pyth oracle price (admin = LP, holds both sides).
// Test swaps skew the pools off-oracle → deposits slip; this resets them.
// usage: RPC_URL=… pnpm rebalance-pools
const TOL = 0.002; // stop within 0.2% of oracle

const keyOfMint = (cfg: ReturnType<typeof loadBasketsConfig>, mint: string) =>
  Object.entries(cfg.mints).find(([, m]) => m === mint)?.[0];
const feedOf = (key: string) => SUPPORTED_ASSETS.find((a) => a.key === key)!.feedHex;

async function fund(conn: any, admin: any, mint: any, whole: number, decimals: number) {
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey);
  await mintTo(conn, admin, mint, ata.address, admin, BigInt(Math.ceil(whole)) * 10n ** BigInt(decimals));
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const cfg = loadBasketsConfig();
  const pools = loadPoolsConfig();
  const usdc = cfg.mints["usdc"]!;
  const raydium = await loadRaydium(conn, admin);

  for (const [poolKey, pool] of Object.entries(pools.pools)) {
    const assetMint = pool.token0Mint === usdc ? pool.token1Mint : pool.token0Mint;
    const key = keyOfMint(cfg, assetMint);
    if (!key) continue;
    const oracle = (await latestPricesMicro([feedOf(key)]))[feedOf(key)] / 1e6; // usd per whole asset
    console.log(`\n[${poolKey}] oracle $${oracle}`);

    for (let iter = 0; iter < 12; iter++) {
      const { poolInfo, rpcData } = await getPoolRpc(raydium, pool.poolId);
      const usdcIsA = poolInfo.mintA.address === usdc;
      const usdcRes = Number(usdcIsA ? rpcData.baseReserve : rpcData.quoteReserve);
      const assetRes = Number(usdcIsA ? rpcData.quoteReserve : rpcData.baseReserve);
      const decA = (usdcIsA ? poolInfo.mintB : poolInfo.mintA).decimals;

      const spot = usdcRes / 1e6 / (assetRes / 10 ** decA); // usd per whole asset
      const off = spot / oracle - 1;
      if (Math.abs(off) <= TOL) {
        console.log(`  ✓ spot $${spot.toFixed(6)} (within ${(TOL * 100).toFixed(1)}%) — done`);
        break;
      }
      // constant-product target reserves at oracle (raw units)
      const k = usdcRes * assetRes;
      const oracleRaw = oracle * 10 ** (6 - decA); // usdc-raw per asset-raw
      const assetTarget = Math.sqrt(k / oracleRaw);
      const usdcTarget = Math.sqrt(k * oracleRaw);

      let inputMint: string, amountRaw: number, inDecimals: number;
      if (assetTarget > assetRes) {
        inputMint = assetMint; // pool short asset → push asset in
        amountRaw = assetTarget - assetRes;
        inDecimals = decA;
      } else {
        inputMint = usdc; // pool short usdc → push usdc in
        amountRaw = usdcTarget - usdcRes;
        inDecimals = 6;
      }
      const whole = amountRaw / 10 ** inDecimals;
      console.log(`  spot $${spot.toFixed(6)} (${(off * 100).toFixed(2)}%) → swap ${whole.toFixed(4)} ${inputMint === usdc ? "USDC" : key} in`);

      await fund(conn, admin, pk(inputMint), whole * 1.05 + 1, inDecimals); // ensure admin has it
      const { ixs } = await buildCpmmSwapIxs(raydium, pool.poolId, inputMint, new BN(Math.round(amountRaw)), 500);
      await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [admin], { commitment: "confirmed" });
    }
  }
  console.log("\n✅ pools re-balanced to oracle.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  });
