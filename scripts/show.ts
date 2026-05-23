import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pk, rawBalance } from "../sdk/src/config.js";
import { computeDrift } from "../sdk/src/math.js";
import { latestPricesMicro } from "../sdk/src/pyth.js";

interface BasketAcct {
  paused: boolean;
  rebalanceThresholdBps: number;
  rebalanceThresholdRelBps: number;
  rebalanceSpreadBps: number;
  depositFeeBps: number;
  lastRebalanceTs: { toNumber(): number };
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketsConfig();
  console.log(`program ${cfg.programId} | ${cfg.baskets.length} baskets\n`);

  for (const b of cfg.baskets) {
    const acct = (await program.account.basket.fetch(
      pk(b.basket),
    )) as unknown as BasketAcct;
    const balances = await Promise.all(
      b.vaults.map((v) => rawBalance(conn, pk(v))),
    );
    const prices = await latestPricesMicro(b.assets.map((a) => a.feed));
    const pricesMicro = b.assets.map((a) => prices[a.feed] ?? 0);
    const { navMicro, weightsBps, maxDriftBps, relDriftBps } = computeDrift(
      balances,
      pricesMicro,
      b.assets,
    );
    const maxRelBps = relDriftBps.length ? Math.max(...relDriftBps) : 0;
    const supply = (await conn.getTokenSupply(pk(b.basketMint))).value;

    console.log(`■ ${b.label}  [${b.basket}]`);
    console.log(
      "   " +
        b.assets
          .map(
            (a, i) =>
              `${a.key.toUpperCase()} ${((weightsBps[i] ?? 0) / 100).toFixed(0)}%→${(a.weightBps / 100).toFixed(0)}%`,
          )
          .join("   "),
    );
    console.log(
      `   NAV $${(navMicro / 1e6).toFixed(2)} | supply ${supply.uiAmount} | ` +
        `drift abs ${(maxDriftBps / 100).toFixed(2)}%/rel ${(maxRelBps / 100).toFixed(2)}% ` +
        `(thr ${(acct.rebalanceThresholdBps / 100).toFixed(2)}%/${(acct.rebalanceThresholdRelBps / 100).toFixed(2)}%) | ` +
        `spread ${(acct.rebalanceSpreadBps / 100).toFixed(2)}% | fee ${(acct.depositFeeBps / 100).toFixed(2)}% | paused ${acct.paused}\n`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
