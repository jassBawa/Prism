import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, Keypair } from "@solana/web3.js";
import { explorer } from "../sdk/src/constants.js";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { fetchAllBaskets, type OnchainBasket } from "../sdk/src/baskets.js";
import { pk, rawBalance } from "../sdk/src/config.js";
import { rebalanceRemaining } from "../sdk/src/accounts.js";
import { computeDrift } from "../sdk/src/math.js";
import { latestPricesMicro, sendWithPyth } from "../sdk/src/pyth.js";
import type { MiniSymmetry } from "../sdk/src/mini_symmetry.js";

// Keeper holds the mock-swap reserves. On devnet these are OUR test mints (admin =
// mint authority), so top them up when low → mock-swap liquidity never dries up.
const MIN_RESERVE_WHOLE = 5_000;
const TARGET_RESERVE_WHOLE = 50_000;

async function topUpReserves(conn: Connection, admin: Keypair, baskets: OnchainBasket[]): Promise<void> {
  const seen = new Map<string, number>(); // mint -> decimals
  for (const b of baskets) for (const a of b.assets) if (!seen.has(a.mint)) seen.set(a.mint, a.decimals);
  for (const [mint, decimals] of seen) {
    try {
      const reserve = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(mint), admin.publicKey)).address;
      const bal = await rawBalance(conn, reserve);
      const min = BigInt(MIN_RESERVE_WHOLE) * 10n ** BigInt(decimals);
      if (bal < min) {
        const amt = BigInt(TARGET_RESERVE_WHOLE) * 10n ** BigInt(decimals) - bal;
        await mintTo(conn, admin, pk(mint), reserve, admin, amt);
        console.log(`  reserve top-up: ${mint.slice(0, 6)} → ~${TARGET_RESERVE_WHOLE}`);
      }
    } catch {
      // admin isn't the mint authority for this asset (e.g. a real mainnet mint) — skip.
    }
  }
}

async function tickBasket(conn: Connection, program: Program<MiniSymmetry>, admin: Keypair, b: OnchainBasket): Promise<void> {
  if (b.paused) return;
  const balances = await Promise.all(b.vaults.map((v) => rawBalance(conn, pk(v))));
  const prices = await latestPricesMicro(b.assets.map((a) => a.feed));
  const pricesMicro = b.assets.map((a) => prices[a.feed] ?? 0);
  const { navMicro, weightsBps, maxDriftBps } = computeDrift(balances, pricesMicro, b.assets);
  const elapsed = Math.floor(Date.now() / 1000) - b.lastRebalanceTs;
  const label = `#${b.id} ${b.assets.map((a) => a.key.toUpperCase()).join("/")}`;
  console.log(
    `[${label}] nav=$${(navMicro / 1e6).toFixed(2)} w=[${weightsBps.map((w) => (w / 100).toFixed(0)).join("/")}]% ` +
      `drift=${(maxDriftBps / 100).toFixed(2)}% (thr ${(b.thresholdBps / 100).toFixed(2)}%) elapsed=${elapsed}s`,
  );
  if (navMicro === 0 || maxDriftBps < b.thresholdBps || elapsed < b.intervalSecs) return;

  console.log(`  → rebalancing ${label}…`);
  const keeper = admin.publicKey;
  const sigs = await sendWithPyth(conn, admin, b.assets.map((a) => a.feed), (priceFor) =>
    program.methods
      .rebalance()
      .accountsPartial({ basket: b.pubkey, keeper, tokenProgram: TOKEN_PROGRAM_ID })
      .remainingAccounts(rebalanceRemaining(b.pubkey, keeper, b.assets, priceFor))
      .instruction(),
  );
  console.log("  ✅", sigs.map((s) => explorer("tx", s)).join(" "));
}

export interface KeeperOpts {
  once?: boolean;
  pollMs?: number;
}

/** Discover every basket on-chain, top up reserves, rebalance those that drifted. */
export async function startKeeper(opts: KeeperOpts = {}): Promise<void> {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const pollMs = opts.pollMs ?? Number(process.env.KEEPER_POLL_MS ?? "7000");
  console.log(`keeper ${opts.once ? "(single tick)" : `polling every ${pollMs}ms`} | RPC ${process.env.RPC_URL ?? "devnet"}`);
  do {
    try {
      const baskets = await fetchAllBaskets(program);
      await topUpReserves(conn, admin, baskets);
      for (const b of baskets) {
        try {
          await tickBasket(conn, program, admin, b);
        } catch (e) {
          console.error(`[#${b.id}] tick error:`, (e as Error).message);
        }
      }
    } catch (e) {
      console.error("keeper loop error:", (e as Error).message);
    }
    if (!opts.once) await new Promise((r) => setTimeout(r, pollMs));
  } while (!opts.once);
}
