import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";

const CONFIG_PATH = resolve(process.cwd(), ".keys/basket.json");

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

export const pk = (s: string): PublicKey => new PublicKey(s);

export async function rawBalance(conn: Connection, account: PublicKey): Promise<bigint> {
  const bal = await conn.getTokenAccountBalance(account).catch(() => null);
  return bal ? BigInt(bal.value.amount) : 0n;
}
