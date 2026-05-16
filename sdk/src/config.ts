import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";

export interface BasketConfig {
  programId: string;
  basket: string;
  basketMint: string;
  mints: { sol: string; jup: string; usdc: string };
  vaults: { sol: string; jup: string; usdc: string };
}

export function loadBasketConfig(): BasketConfig {
  return JSON.parse(readFileSync(resolve(process.cwd(), ".keys/basket.json"), "utf8")) as BasketConfig;
}

export const pk = (s: string): PublicKey => new PublicKey(s);

type ParsedAmount = { parsed: { info: { tokenAmount: { uiAmount: number | null } } } };

export async function uiBalance(conn: Connection, owner: PublicKey, mint: PublicKey): Promise<number> {
  const res = await conn.getParsedTokenAccountsByOwner(owner, { mint });
  return res.value.reduce((s, a) => s + ((a.account.data as unknown as ParsedAmount).parsed.info.tokenAmount.uiAmount ?? 0), 0);
}

export async function rawBalance(conn: Connection, account: PublicKey): Promise<bigint> {
  const bal = await conn.getTokenAccountBalance(account).catch(() => null);
  return bal ? BigInt(bal.value.amount) : 0n;
}
