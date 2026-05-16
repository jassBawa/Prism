import "dotenv/config";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RPC_URL, idl } from "./constants.js";
import type { MiniSymmetry } from "./mini_symmetry.js";

export const ADMIN_KEYPAIR_PATH = resolve(process.cwd(), ".keys/admin.json");

/** Loads the admin/keeper signer (devnet). ADMIN_SECRET_KEY (json array or path) overrides .keys/admin.json. */
export function loadKeypair(path: string = ADMIN_KEYPAIR_PATH): Keypair {
  const env = process.env.ADMIN_SECRET_KEY?.trim();
  let raw: string;
  if (env?.startsWith("[")) raw = env;
  else if (env && existsSync(env)) raw = readFileSync(env, "utf8");
  else raw = readFileSync(path, "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getProgram(kp: Keypair, connection: Connection = getConnection()) {
  const provider = new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed" });
  // Anchor 0.30+: program id comes from idl.address — two-arg constructor.
  const program = new Program<MiniSymmetry>(idl as MiniSymmetry, provider);
  return { provider, program, connection };
}
