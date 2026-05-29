import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, loadPoolsConfig, pickBasket, poolForPair, pk, rawBalance } from "../sdk/src/config.js";
import { vaultAta } from "../sdk/src/pdas.js";
import { rebalanceOneRemaining } from "../sdk/src/accounts.js";
import { latestPricesMicro, sendWithPyth } from "../sdk/src/pyth.js";

// Real rebalance: swap one asset vs the quote on Raydium (basket PDA signs the CPI).
// usage: RPC_URL=… pnpm rebalance-real <basket> [assetIndex]
const BASKET = process.argv[2] ?? "A2iu881sqCb2tqgHGWFobwRWJpzkTe1ApDgxvwNNec6Y"; // SOL Core
const ASSET_I = Number(process.argv[3] ?? "0");

async function values(conn: any, b: any, prices: any) {
  const out: number[] = [];
  for (const a of b.assets) {
    const bal = Number(await rawBalance(conn, vaultAta(pk(b.basket), pk(a.mint)))) / 10 ** a.decimals;
    out.push(bal * (prices[a.feed] / 1e6));
  }
  return out;
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketsConfig();
  const pools = loadPoolsConfig();
  const b = pickBasket(cfg, BASKET);
  const asset = b.assets[ASSET_I]!;
  const quote = b.assets[b.quoteIndex]!;
  const pool = poolForPair(pools, quote.mint, asset.mint)!;
  const cpmm = pk(pools.cpmmProgram);

  const prices = await latestPricesMicro(b.assets.map((a: any) => a.feed));
  const before = await values(conn, b, prices);
  const nav0 = before.reduce((s, v) => s + v, 0);
  console.log(
    `"${b.label}" weights:`,
    b.assets.map((a: any, i: number) => `${a.key} ${((before[i]! / nav0) * 100).toFixed(1)}% (tgt ${a.weightBps / 100}%)`).join("  "),
  );

  // direction: asset under-weight vs quote (value_i/value_q < w_i/w_q) -> buy asset
  const ratio = before[ASSET_I]! / before[b.quoteIndex]!;
  const target = asset.weightBps / quote.weightBps;
  const buy = ratio < target;
  console.log(`asset ${asset.key}: value-ratio ${ratio.toFixed(3)} vs target ${target.toFixed(3)} -> ${buy ? "BUY" : "SELL"} ${asset.key}`);

  const sigs = await sendWithPyth(conn, admin, [asset.feed, quote.feed], async (priceFor: any) =>
    program.methods
      .rebalanceOne(ASSET_I)
      .accountsPartial({ basket: pk(b.basket), keeper: admin.publicKey })
      .remainingAccounts(rebalanceOneRemaining(pk(b.basket), asset, quote, pool, buy, priceFor, cpmm))
      .instruction(),
  );
  console.log("rebalanced:", sigs[sigs.length - 1]);

  const after = await values(conn, b, prices);
  const nav1 = after.reduce((s, v) => s + v, 0);
  console.log(
    `after:`,
    b.assets.map((a: any, i: number) => `${a.key} ${((after[i]! / nav1) * 100).toFixed(1)}%`).join("  "),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e.message ?? e);
    process.exit(1);
  });
