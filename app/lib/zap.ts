"use client";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import poolsJson from "./pools.json";

interface PoolEntry {
  poolId: string;
  token0Mint: string;
  token1Mint: string;
}
const POOLS = (poolsJson as { pools: Record<string, PoolEntry> }).pools;

/** Find the CPMM pool for a (mintA, mintB) pair, either token order. */
export function poolForPair(mintA: string, mintB: string): PoolEntry | null {
  for (const p of Object.values(POOLS)) {
    const s = new Set([p.token0Mint, p.token1Mint]);
    if (s.has(mintA) && s.has(mintB)) return p;
  }
  return null;
}

type SerIx = { programId: string; keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };

const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Ask the server to build Raydium CPMM swap ixs; deserialize to web3 instructions. */
export async function fetchSwapIxs(
  ownerPubkey: string,
  items: { poolId: string; inputMint: string; amountInRaw: string }[],
  slippageBps = 80,
  rpc?: string,
): Promise<{ ixs: TransactionInstruction[]; expected: string[] }> {
  const res = await fetch("/api/zap-swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ownerPubkey, items, slippageBps, rpc }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "swap build failed");
  const ixs: TransactionInstruction[] = (j.ixs as SerIx[]).map(
    (s) =>
      new TransactionInstruction({
        programId: new PublicKey(s.programId),
        keys: s.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
        data: Buffer.from(b64ToBytes(s.data)),
      }),
  );
  return { ixs, expected: j.expected as string[] };
}
