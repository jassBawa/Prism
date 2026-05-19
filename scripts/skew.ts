import { mintTo } from "@solana/spl-token";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { vaultAta } from "../sdk/src/pdas.js";
import { latestPricesMicro } from "../sdk/src/pyth.js";

// Force drift on demand for the demo: mint ~$addUsd of one asset straight into a
// basket's vault (admin holds the test-mint authority) so it goes over-weight.
// The keeper / rebalance then visibly trims it back to target.
//   pnpm run skew <assetKey> [addUsd] [basketPubkey]
const ASSET = process.argv[2];
const ADD_USD = Number(process.argv[3] ?? "300");
const BASKET_ARG = process.argv[4];

async function main() {
  if (!ASSET) {
    console.error("usage: pnpm run skew <assetKey> [addUsd] [basketPubkey]");
    process.exit(1);
  }
  const conn = getConnection();
  const admin = loadKeypair();
  const b = pickBasket(loadBasketsConfig(), BASKET_ARG);
  const asset = b.assets.find((a) => a.key === ASSET);
  if (!asset) {
    console.error(`basket "${b.label}" has no asset "${ASSET}" (has: ${b.assets.map((a) => a.key).join(", ")})`);
    process.exit(1);
  }

  const prices = await latestPricesMicro([asset.feed]);
  const usd = (prices[asset.feed] ?? 0) / 1e6;
  if (usd <= 0) {
    console.error("no Pyth price for", ASSET);
    process.exit(1);
  }
  const rawAmount = BigInt(Math.round((ADD_USD / usd) * 10 ** asset.decimals));
  const vault = vaultAta(pk(b.basket), pk(asset.mint));

  console.log(`Skewing "${b.label}": minting ~$${ADD_USD} of ${ASSET.toUpperCase()} (${rawAmount} raw) into its vault…`);
  await mintTo(conn, admin, pk(asset.mint), vault, admin, rawAmount);
  console.log(`✅ ${ASSET.toUpperCase()} now over-weight. Next:`);
  console.log(`   pnpm run show                       # drift jumps`);
  console.log(`   pnpm run rebalance ${b.basket}   # or: pnpm run keeper`);
}

main().catch((e) => {
  console.error("skew failed:", e);
  process.exit(1);
});
