import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, Keypair } from "@solana/web3.js";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import type { MiniSymmetry } from "../sdk/src/mini_symmetry.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pk, rawBalance, type BasketEntry } from "../sdk/src/config.js";
import { rebalanceRemaining } from "../sdk/src/accounts.js";
import { computeDrift } from "../sdk/src/math.js";
import { latestPricesMicro, sendWithPyth } from "../sdk/src/pyth.js";

const POLL_MS = Number(process.env.KEEPER_POLL_MS ?? "10000");

interface BasketAcct {
  paused: boolean;
  rebalanceThresholdBps: number;
  rebalanceIntervalSecs: { toNumber(): number };
  lastRebalanceTs: { toNumber(): number };
}

async function tickBasket(conn: Connection, program: Program<MiniSymmetry>, admin: Keypair, b: BasketEntry): Promise<void> {
  const acct = (await program.account.basket.fetch(pk(b.basket))) as unknown as BasketAcct;
  if (acct.paused) return console.log(`[${b.label}] paused — skip`);

  const balances = await Promise.all(b.vaults.map((v) => rawBalance(conn, pk(v))));
  const prices = await latestPricesMicro(b.assets.map((a) => a.feed));
  const pricesMicro = b.assets.map((a) => prices[a.feed] ?? 0);
  const { navMicro, weightsBps, maxDriftBps } = computeDrift(balances, pricesMicro, b.assets);
  const elapsed = Math.floor(Date.now() / 1000) - acct.lastRebalanceTs.toNumber();
  console.log(
    `[${b.label}] nav=$${(navMicro / 1e6).toFixed(2)} w=[${weightsBps.map((w) => (w / 100).toFixed(0)).join("/")}]% ` +
      `drift=${(maxDriftBps / 100).toFixed(2)}% (thr ${(acct.rebalanceThresholdBps / 100).toFixed(2)}%) elapsed=${elapsed}s`,
  );

  if (navMicro === 0) return;
  if (maxDriftBps < acct.rebalanceThresholdBps) return;
  if (elapsed < acct.rebalanceIntervalSecs.toNumber()) return;

  console.log(`  → rebalancing ${b.label}...`);
  const keeper = admin.publicKey;
  const basket = pk(b.basket);
  const sigs = await sendWithPyth(conn, admin, b.assets.map((a) => a.feed), (priceFor) =>
    program.methods
      .rebalance()
      .accountsPartial({ basket, keeper, tokenProgram: TOKEN_PROGRAM_ID })
      .remainingAccounts(rebalanceRemaining(basket, keeper, b.assets, priceFor))
      .instruction(),
  );
  console.log("  ✅", sigs.map((s) => explorer("tx", s)).join(" "));
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const once = process.argv.includes("--once");
  console.log(`keeper${once ? " (single tick)" : ` polling every ${POLL_MS}ms`} | RPC ${process.env.RPC_URL ?? "devnet"}`);
  do {
    const cfg = loadBasketsConfig();
    for (const b of cfg.baskets) {
      try {
        await tickBasket(conn, program, admin, b);
      } catch (e) {
        console.error(`[${b.label}] tick error:`, (e as Error).message);
      }
    }
    if (!once) await new Promise((r) => setTimeout(r, POLL_MS));
  } while (!once);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
