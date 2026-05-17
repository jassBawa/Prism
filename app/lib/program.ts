import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "./idl.json";
import type { MiniSymmetry } from "./mini_symmetry";
import { PROGRAM_ID, RPC_URL } from "./constants";

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export const basketPda = (): PublicKey => PublicKey.findProgramAddressSync([Buffer.from("basket-v2")], PROGRAM_ID)[0];

/** Read-only program (dummy wallet) for fetching account data. */
export function getReadProgram(connection: Connection = getConnection()): Program<MiniSymmetry> {
  const dummy = new AnchorProvider(connection, { publicKey: Keypair.generate().publicKey } as unknown as Wallet, {
    commitment: "confirmed",
  });
  return new Program<MiniSymmetry>(idl as MiniSymmetry, dummy);
}

/** A connected browser wallet (subset of anchor's Wallet — no `payer`). */
export type WalletLike = Pick<Wallet, "publicKey" | "signTransaction" | "signAllTransactions">;

/** Program bound to a connected wallet for signing. */
export function getProgram(wallet: WalletLike, connection: Connection = getConnection()): Program<MiniSymmetry> {
  const provider = new AnchorProvider(connection, wallet as Wallet, { commitment: "confirmed" });
  return new Program<MiniSymmetry>(idl as MiniSymmetry, provider);
}
