import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";

const CONFIG_PATH = resolve(process.cwd(), ".keys/basket.json");
const POOLS_PATH = resolve(process.cwd(), ".keys/pools.json");

export interface AssetEntry {
  key: string; // supported-asset key (sol/jup/bonk/usdc)
  mint: string;
  feed: string; // feed hex, no 0x
  decimals: number;
  weightBps: number;
}

export interface BasketEntry {
  label: string;
  creator: string;
  id: number;
  basket: string;
  basketMint: string;
  quoteIndex: number;
  thresholdBps: number;
  thresholdRelBps: number;
  spreadBps: number;
  feeBps: number;
  intervalSecs: number;
  assets: AssetEntry[];
  vaults: string[]; // vault ATA per asset, same order as assets
}

export interface BasketsConfig {
  programId: string;
  /** mint per supported-asset key (the controlled test mints). */
  mints: Record<string, string>;
  baskets: BasketEntry[];
}

export function loadBasketsConfig(): BasketsConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as BasketsConfig;
}

export function saveBasketsConfig(cfg: BasketsConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

/** Pick a basket by pubkey, or the first if not given. */
export function pickBasket(cfg: BasketsConfig, basketPk?: string): BasketEntry {
  if (basketPk) {
    const b = cfg.baskets.find((x) => x.basket === basketPk);
    if (!b) throw new Error(`basket not found in config: ${basketPk}`);
    return b;
  }
  if (cfg.baskets.length === 0) throw new Error("no baskets in config");
  return cfg.baskets[0]!;
}

// ---- Raydium CPMM pools (real on-chain swaps, devnet) ----------------------

export interface PoolEntry {
  poolId: string;
  token0Mint: string;
  token1Mint: string;
  vault0: string;
  vault1: string;
  observation: string;
  authority: string;
  lpMint: string;
  configId: string;
}

export interface PoolsConfig {
  /** the devnet CPMM program these pools live under (DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM). */
  cpmmProgram: string;
  cpmmFeeAcc: string;
  ammConfig: string;
  /** keyed "usdc-<asset>" (e.g. usdc-sol). */
  pools: Record<string, PoolEntry>;
}

export function loadPoolsConfig(): PoolsConfig {
  if (!existsSync(POOLS_PATH)) {
    return { cpmmProgram: "", cpmmFeeAcc: "", ammConfig: "", pools: {} };
  }
  return JSON.parse(readFileSync(POOLS_PATH, "utf8")) as PoolsConfig;
}

export function savePoolsConfig(cfg: PoolsConfig): void {
  writeFileSync(POOLS_PATH, JSON.stringify(cfg, null, 2));
}

/** Pool for a (quote, asset) pair, regardless of stored key order. Returns null if absent. */
export function poolForPair(cfg: PoolsConfig, mintA: string, mintB: string): PoolEntry | null {
  for (const p of Object.values(cfg.pools)) {
    const m = new Set([p.token0Mint, p.token1Mint]);
    if (m.has(mintA) && m.has(mintB)) return p;
  }
  return null;
}

export const pk = (s: string): PublicKey => new PublicKey(s);

export async function rawBalance(
  conn: Connection,
  account: PublicKey,
): Promise<bigint> {
  const bal = await conn.getTokenAccountBalance(account).catch(() => null);
  return bal ? BigInt(bal.value.amount) : 0n;
}
