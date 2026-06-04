import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import { type Connection, type Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { explorer } from "../sdk/src/constants.js";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { fetchAllBaskets, type OnchainBasket } from "../sdk/src/baskets.js";
import { loadPoolsConfig, poolForPair, pk, rawBalance, type PoolsConfig } from "../sdk/src/config.js";
import { rebalanceOneRemaining, rebalanceRemaining } from "../sdk/src/accounts.js";
import { computeDrift, driftTriggers } from "../sdk/src/math.js";
import { latestPricesMicro, sendWithPyth } from "../sdk/src/pyth.js";
import type { MiniSymmetry } from "../sdk/src/mini_symmetry.js";
import { rearbPools } from "./pools.js";
import { recordNav } from "./history.js";

const now = () => Math.floor(Date.now() / 1000);
const labelOf = (b: OnchainBasket) => `#${b.id} ${b.assets.map((a) => a.key.toUpperCase()).join("/")}`;

/** A fund is "real" (swaps on Raydium) if every non-quote asset has a pool with the quote. */
function realPath(b: OnchainBasket, pools: PoolsConfig): boolean {
  if (!pools.cpmmProgram) return false;
  const quote = b.assets[b.quoteIndex]!;
  return b.assets.every((a, i) => i === b.quoteIndex || !!poolForPair(pools, quote.mint, a.mint));
}

// Mock-swap reserves (only for funds without Raydium pools). Admin mints the test tokens.
const MIN_RESERVE_WHOLE = 5_000;
const TARGET_RESERVE_WHOLE = 50_000;

async function topUpReserves(conn: Connection, admin: Keypair, baskets: OnchainBasket[]): Promise<void> {
  const seen = new Map<string, number>();
  for (const b of baskets) for (const a of b.assets) if (!seen.has(a.mint)) seen.set(a.mint, a.decimals);
  for (const [mint, decimals] of seen) {
    try {
      const reserve = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(mint), admin.publicKey)).address;
      const bal = await rawBalance(conn, reserve);
      const min = BigInt(MIN_RESERVE_WHOLE) * 10n ** BigInt(decimals);
      if (bal < min) {
        await mintTo(conn, admin, pk(mint), reserve, admin, BigInt(TARGET_RESERVE_WHOLE) * 10n ** BigInt(decimals) - bal);
        console.log(`  reserve top-up: ${mint.slice(0, 6)} → ~${TARGET_RESERVE_WHOLE}`);
      }
    } catch {
      /* admin not mint authority (e.g. a real mainnet mint) — skip */
    }
  }
}

/** Does any non-quote leg breach the pairwise threshold AND have a pool? This is the real
 *  path's true firing condition (matches `rebalance_one`), unlike the NAV dual gate used for
 *  the mock path — so the keeper only calls rebalanceReal when a swap will actually fire. */
function someLegQualifies(b: OnchainBasket, balances: bigint[], prices: Record<string, number>, pools: PoolsConfig): boolean {
  const qi = b.quoteIndex;
  const quote = b.assets[qi]!;
  const value = (i: number) => (Number(balances[i]) / 10 ** b.assets[i]!.decimals) * ((prices[b.assets[i]!.feed] ?? 0) / 1e6);
  const vq = value(qi);
  if (vq <= 0) return false;
  for (let i = 0; i < b.assets.length; i++) {
    if (i === qi) continue;
    const a = b.assets[i]!;
    const lhs = value(i) * quote.weightBps;
    const rhs = a.weightBps * vq;
    const denom = Math.max(lhs, rhs);
    const driftBps = denom > 0 ? (Math.abs(lhs - rhs) / denom) * 10000 : 0;
    if (driftBps >= b.thresholdBps && poolForPair(pools, quote.mint, a.mint)) return true;
  }
  return false;
}

/** Real: swap each off-target asset vs the quote on Raydium (one tx per asset). */
async function rebalanceReal(
  conn: Connection,
  program: Program<MiniSymmetry>,
  admin: Keypair,
  b: OnchainBasket,
  pools: PoolsConfig,
): Promise<void> {
  const prices = await latestPricesMicro(b.assets.map((a) => a.feed));
  const qi = b.quoteIndex;
  const quote = b.assets[qi]!;
  const cpmm = pk(pools.cpmmProgram);

  for (let i = 0; i < b.assets.length; i++) {
    if (i === qi) continue;
    const a = b.assets[i]!;
    // Re-read both vaults fresh per leg: an earlier leg's swap mutates the quote vault,
    // so a once-read snapshot would size later deltas on stale balances.
    const [balI, balQ] = await Promise.all([rawBalance(conn, pk(b.vaults[i]!)), rawBalance(conn, pk(b.vaults[qi]!))]);
    const valueI = (Number(balI) / 10 ** a.decimals) * ((prices[a.feed] ?? 0) / 1e6);
    const vq = (Number(balQ) / 10 ** quote.decimals) * ((prices[quote.feed] ?? 0) / 1e6);
    if (vq <= 0) continue;
    const lhs = valueI * quote.weightBps;
    const rhs = a.weightBps * vq;
    const denom = Math.max(lhs, rhs);
    const driftBps = denom > 0 ? (Math.abs(lhs - rhs) / denom) * 10000 : 0;
    if (driftBps < b.thresholdBps) continue;
    const pool = poolForPair(pools, quote.mint, a.mint);
    if (!pool) continue;
    const buy = rhs > lhs;
    console.log(`  → ${buy ? "BUY" : "SELL"} ${a.key.toUpperCase()} on Raydium (drift ${(driftBps / 100).toFixed(2)}%)…`);
    const sigs = await sendWithPyth(conn, admin, [a.feed, quote.feed], (priceFor) =>
      program.methods
        .rebalanceOne(i)
        .accountsPartial({ basket: b.pubkey, keeper: admin.publicKey })
        .remainingAccounts(rebalanceOneRemaining(b.pubkey, a, quote, pool, buy, priceFor, cpmm))
        .instruction(),
    );
    console.log("  ✅", explorer("tx", sigs[sigs.length - 1]!));
  }
}

/** Mock: oracle-priced swap against the keeper's own reserve. */
async function rebalanceMock(
  conn: Connection,
  program: Program<MiniSymmetry>,
  admin: Keypair,
  b: OnchainBasket,
): Promise<void> {
  console.log(`  → rebalancing ${labelOf(b)} (mock)…`);
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

async function tickBasket(
  conn: Connection,
  program: Program<MiniSymmetry>,
  admin: Keypair,
  b: OnchainBasket,
  pools: PoolsConfig,
): Promise<void> {
  if (b.paused) return;
  const balances = await Promise.all(b.vaults.map((v) => rawBalance(conn, pk(v))));
  const prices = await latestPricesMicro(b.assets.map((a) => a.feed));
  const drift = computeDrift(balances, b.assets.map((a) => prices[a.feed] ?? 0), b.assets);
  const { navMicro, weightsBps, maxDriftBps } = drift;
  void recordNav(b.pubkey.toBase58(), navMicro / 1e6); // persist a snapshot (best-effort, async)
  const elapsed = now() - b.lastRebalanceTs;
  const real = realPath(b, pools);
  console.log(
    `[${labelOf(b)}] ${real ? "raydium" : "mock"} nav=$${(navMicro / 1e6).toFixed(2)} ` +
      `w=[${weightsBps.map((w) => (w / 100).toFixed(0)).join("/")}]% drift=${(maxDriftBps / 100).toFixed(2)}% ` +
      `(thr ${(b.thresholdBps / 100).toFixed(2)}%) elapsed=${elapsed}s`,
  );
  // Real path fires on the pairwise per-leg gate it actually enforces on-chain; mock path uses
  // the NAV dual gate. Matching the gate avoids no-op ticks / AlreadyBalanced reverts.
  const fired = real ? someLegQualifies(b, balances, prices, pools) : driftTriggers(drift, b.thresholdBps, b.thresholdRelBps);
  if (navMicro === 0 || elapsed < b.intervalSecs || !fired) return;

  if (real) await rebalanceReal(conn, program, admin, b, pools);
  else await rebalanceMock(conn, program, admin, b);
}

export interface KeeperOpts {
  once?: boolean;
  pollMs?: number;
}

/** Discover every basket, rebalance those that drifted (Raydium if pools exist, else mock). */
export async function startKeeper(opts: KeeperOpts = {}): Promise<void> {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const pools = loadPoolsConfig();
  const pollMs = opts.pollMs ?? Number(process.env.KEEPER_POLL_MS ?? "7000");
  const minSol = Number(process.env.KEEPER_MIN_SOL ?? "0.3"); // below this, skip (sims would fail)
  const rearbEvery = Number(process.env.KEEPER_REARB_EVERY ?? "40"); // ~40 ticks ≈ 4.7min @7s
  console.log(
    `keeper ${opts.once ? "(single tick)" : `polling every ${pollMs}ms`} | RPC ${process.env.RPC_URL ?? "devnet"} | pools ${Object.keys(pools.pools).length}`,
  );
  let tickN = 0;
  do {
    try {
      const baskets = await fetchAllBaskets(program);

      // SOL guard: posting Pyth prices + swaps cost SOL; if admin runs dry, every rebalance
      // sim fails with InsufficientFunds. Warn loudly and skip the cycle until refilled.
      const adminSol = (await conn.getBalance(admin.publicKey)) / LAMPORTS_PER_SOL;
      if (adminSol < minSol) {
        console.warn(`⚠ admin SOL low (${adminSol.toFixed(4)} < ${minSol}) — skipping cycle; fund ${admin.publicKey.toBase58()}`);
      } else {
        // Self-heal liquidity: keep in-use CPMM pools pegged to oracle (on boot + periodically)
        // so the program's oracle-bounded swaps don't revert with ExceededSlippage.
        if (pools.cpmmProgram && tickN % rearbEvery === 0) {
          try {
            const r = await rearbPools(conn, admin, baskets, pools);
            if (r.fixed) console.log(`pool re-arb: fixed ${r.fixed}/${r.checked} pool(s)`);
          } catch (e) {
            console.error("pool re-arb error:", (e as Error).message);
          }
        }

        const mockFunds = baskets.filter((b) => !realPath(b, pools));
        if (mockFunds.length) await topUpReserves(conn, admin, mockFunds);
        for (const b of baskets) {
          try {
            await tickBasket(conn, program, admin, b, pools);
          } catch (e) {
            console.error(`[#${b.id}] tick error:`, (e as Error).message);
          }
        }
      }
      tickN++;
    } catch (e) {
      console.error("keeper loop error:", (e as Error).message);
    }
    if (!opts.once) await new Promise((r) => setTimeout(r, pollMs));
  } while (!opts.once);
}
