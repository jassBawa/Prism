import type { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { MiniSymmetry } from "./mini_symmetry.js";
import { intentPda } from "./pdas.js";

/** A pending, time-locked param change for a basket. */
export interface OnchainIntent {
  basket: PublicKey;
  proposer: PublicKey;
  activateTs: number;
  thresholdBps: number;
  thresholdRelBps: number;
  spreadBps: number;
  depositFeeBps: number;
  intervalSecs: number;
}

/** Fetch the pending intent for a basket, or null if none. */
export async function fetchIntent(
  program: Program<MiniSymmetry>,
  basket: PublicKey,
): Promise<OnchainIntent | null> {
  const raw = await program.account.intent.fetchNullable(intentPda(basket));
  if (!raw) return null;
  return {
    basket: raw.basket,
    proposer: raw.proposer,
    activateTs: Number(raw.activateTs),
    thresholdBps: raw.thresholdBps,
    thresholdRelBps: raw.thresholdRelBps,
    spreadBps: raw.spreadBps,
    depositFeeBps: raw.depositFeeBps,
    intervalSecs: Number(raw.intervalSecs),
  };
}
