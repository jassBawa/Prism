import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketConfig, pk, rawBalance, type BasketConfig } from "../sdk/src/config.js";
import { basketPda } from "../sdk/src/pdas.js";
import { computeDrift } from "../sdk/src/math.js";
import { latestPricesMicro, sendWithPyth } from "../sdk/src/pyth.js";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, Keypair } from "@solana/web3.js";

const POLL_MS = Number(process.env.KEEPER_POLL_MS ?? "10000");

interface BasketState {
  paused: boolean;
  rebalanceThresholdBps: number;
  rebalanceIntervalSecs: { toNumber(): number };
  lastRebalanceTs: { toNumber(): number };
}

async function tick(conn: Connection, program: Program, admin: Keypair, cfg: BasketConfig): Promise<void> {
  const b = (await program.account.basket.fetch(basketPda())) as unknown as BasketState;
  if (b.paused) {
    console.log("paused — skip");
    return;
  }
  const balances = [
    await rawBalance(conn, pk(cfg.vaults.sol)),
    await rawBalance(conn, pk(cfg.vaults.jup)),
    await rawBalance(conn, pk(cfg.vaults.usdc)),
  ];
  const prices = await latestPricesMicro();
  const { navMicro, weightsBps, maxDriftBps } = computeDrift(balances, [prices.sol, prices.jup, prices.usdc]);
  const elapsed = Math.floor(Date.now() / 1000) - b.lastRebalanceTs.toNumber();
  console.log(
    `nav=$${(navMicro / 1e6).toFixed(2)} weights=[${weightsBps.map((w) => (w / 100).toFixed(0)).join("/")}]% ` +
      `drift=${(maxDriftBps / 100).toFixed(2)}% (thr ${(b.rebalanceThresholdBps / 100).toFixed(2)}%) elapsed=${elapsed}s`,
  );

  if (navMicro === 0) return console.log("empty vault — skip");
  if (maxDriftBps < b.rebalanceThresholdBps) return console.log("drift below threshold — skip");
  if (elapsed < b.rebalanceIntervalSecs.toNumber()) return console.log("interval not elapsed — skip");

  console.log("→ rebalancing...");
  const keeper = admin.publicKey;
  const reserve = (mint: string) => getAssociatedTokenAddressSync(pk(mint), keeper);
  const sigs = await sendWithPyth(conn, admin, (price) =>
    program.methods
      .rebalance()
      .accountsPartial({
        basket: pk(cfg.basket),
        keeper,
        vaultSol: pk(cfg.vaults.sol),
        vaultJup: pk(cfg.vaults.jup),
        vaultUsdc: pk(cfg.vaults.usdc),
        reserveSol: reserve(cfg.mints.sol),
        reserveJup: reserve(cfg.mints.jup),
        reserveUsdc: reserve(cfg.mints.usdc),
        priceSol: price.sol,
        priceJup: price.jup,
        priceUsdc: price.usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );
  console.log("✅ rebalanced:", sigs.map((s) => explorer("tx", s)).join(" "));
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketConfig();
  const once = process.argv.includes("--once");
  console.log(`keeper${once ? " (single tick)" : ` polling every ${POLL_MS}ms`} | RPC ${process.env.RPC_URL ?? "devnet"}`);
  do {
    try {
      await tick(conn, program, admin, cfg);
    } catch (e) {
      console.error("tick error:", (e as Error).message);
    }
    if (!once) await new Promise((r) => setTimeout(r, POLL_MS));
  } while (!once);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
