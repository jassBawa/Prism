import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { loadBasketConfig, pk, rawBalance } from "../sdk/src/config.js";
import { basketPda } from "../sdk/src/pdas.js";

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketConfig();

  const b = (await program.account.basket.fetch(basketPda())) as {
    authority: { toBase58(): string };
    basketMint: { toBase58(): string };
    paused: boolean;
    rebalanceThresholdBps: number;
    rebalanceIntervalSecs: { toString(): string };
    lastRebalanceTs: { toString(): string };
    assets: { mint: { toBase58(): string }; targetWeightBps: number; decimals: number }[];
  };
  console.log("authority:    ", b.authority.toBase58());
  console.log("basketMint:   ", b.basketMint.toBase58());
  console.log("paused:       ", b.paused);
  console.log("threshold_bps:", b.rebalanceThresholdBps, "| interval:", b.rebalanceIntervalSecs.toString());
  console.log("lastRebalance:", b.lastRebalanceTs.toString());
  console.log("assets:", b.assets.map((a) => ({ mint: a.mint.toBase58().slice(0, 6), w: a.targetWeightBps, dec: a.decimals })));

  for (const k of ["sol", "jup", "usdc"] as const) {
    console.log(`vault ${k}:`, (await rawBalance(conn, pk(cfg.vaults[k]))).toString());
  }
  const supply = (await conn.getTokenSupply(pk(cfg.basketMint))).value;
  console.log("basket supply:", supply.uiAmount, `(raw ${supply.amount})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
