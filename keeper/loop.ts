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
import { fetchIntent } from "../sdk/src/intents.js";
import { intentPda } from "../sdk/src/pdas.js";
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

/** NAV-share value of every asset (micro-USD), in basket order. */
function legValues(b: OnchainBasket, balances: bigint[], prices: Record<string, number>): number[] {
  return b.assets.map((a, i) => (Number(balances[i]) / 10 ** a.decimals) * ((prices[a.feed] ?? 0) / 1e6));
}

/** Does any non-quote leg breach its NAV-share threshold AND have a pool? This matches
 *  `rebalance_one`'s on-chain gate (relative drift of value_i vs `NAV * w_i`), so the
 *  keeper only calls rebalanceReal when a swap will actually fire (no AlreadyBalanced). */
function someLegQualifies(b: OnchainBasket, balances: bigint[], prices: Record<string, number>, pools: PoolsConfig): boolean {
  const quote = b.assets[b.quoteIndex]!;
  const values = legValues(b, balances, prices);
  const nav = values.reduce((s, v) => s + v, 0);
  if (nav <= 0) return false;
  for (let i = 0; i < b.assets.length; i++) {
    if (i === b.quoteIndex) continue;
    const a = b.assets[i]!;
    const target = (nav * a.weightBps) / 10000;
    const denom = Math.max(values[i]!, target);
    const driftBps = denom > 0 ? (Math.abs(values[i]! - target) / denom) * 10000 : 0;
    if (driftBps >= b.thresholdBps && poolForPair(pools, quote.mint, a.mint)) return true;
  }
  return false;
}

/** Real: swap each off-target asset vs the quote on Raydium (one tx per asset). Each leg
 *  is sized to its absolute NAV share on-chain, so a single pass converges — no repeated
 *  rebalances per deposit. Balances are re-read fresh per leg since an earlier leg's swap
 *  moves both that asset's vault and the shared quote vault. */
async function rebalanceReal(
  conn: Connection,
  program: Program<MiniSymmetry>,
  admin: Keypair,
  b: OnchainBasket,
  pools: PoolsConfig,
): Promise<void> {
  const feeds = b.assets.map((a) => a.feed);
  const prices = await latestPricesMicro(feeds);
  const qi = b.quoteIndex;
  const quote = b.assets[qi]!;
  const cpmm = pk(pools.cpmmProgram);

  for (let i = 0; i < b.assets.length; i++) {
    if (i === qi) continue;
    const a = b.assets[i]!;
    const pool = poolForPair(pools, quote.mint, a.mint);
    if (!pool) continue;
    // Re-read ALL vaults fresh per leg, recompute NAV: an earlier leg's swap mutated the
    // quote vault, so a stale snapshot would mis-size this leg's NAV-share target.
    const balances = await Promise.all(b.vaults.map((v) => rawBalance(conn, pk(v))));
    const values = legValues(b, balances, prices);
    const nav = values.reduce((s, v) => s + v, 0);
    if (nav <= 0) continue;
    const target = (nav * a.weightBps) / 10000;
    const valueI = values[i]!;
    const denom = Math.max(valueI, target);
    const driftBps = denom > 0 ? (Math.abs(valueI - target) / denom) * 10000 : 0;
    if (driftBps < b.thresholdBps) continue;
    const buy = target > valueI; // under-weight vs NAV share -> buy with quote
    console.log(`  → ${buy ? "BUY" : "SELL"} ${a.key.toUpperCase()} on Raydium (drift ${(driftBps / 100).toFixed(2)}%)…`);
    const sigs = await sendWithPyth(conn, admin, feeds, (priceFor) =>
      program.methods
        .rebalanceOne(i)
        .accountsPartial({ basket: b.pubkey, keeper: admin.publicKey })
        .remainingAccounts(rebalanceOneRemaining(b.pubkey, b.assets, a, quote, pool, buy, priceFor, cpmm))
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

/** Permissionless governance: apply any pending param change whose time-lock has elapsed.
 *  Plain rpc (no Pyth). Best-effort per basket — never breaks the rebalance loop. The
 *  activator reclaims the closed Intent's rent, so this is a tiny self-funding incentive. */
async function activateRipeIntents(
  program: Program<MiniSymmetry>,
  admin: Keypair,
  baskets: OnchainBasket[],
): Promise<void> {
  const t = now();
  for (const b of baskets) {
    try {
      const it = await fetchIntent(program, b.pubkey);
      if (!it || t < it.activateTs) continue;
      const sig = await program.methods
        .activateIntent()
        .accountsPartial({ basket: b.pubkey, intent: intentPda(b.pubkey), activator: admin.publicKey })
        .rpc();
      console.log(`  ⏱ activated intent on ${labelOf(b)} → fee=${it.depositFeeBps}bps`, explorer("tx", sig));
    } catch (e) {
      console.error(`[#${b.id}] intent activate error:`, (e as Error).message);
    }
  }
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
        await activateRipeIntents(program, admin, baskets);
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
