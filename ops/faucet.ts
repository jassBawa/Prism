import {
  type Connection,
  type Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

// Devnet test-USDC faucet. The ops process holds the admin keypair (the mint authority
// for the play-money test mints), so minting happens here — never in the Vercel app.
// Defaults target the live deployment's test USDC; override via env.
const USDC_MINT = process.env.FAUCET_USDC_MINT ?? "FFrX2Cc5di6CyH1XVM1eey6hbWtaYv6ekfcTDgN9tqCc";
const USDC_DECIMALS = 6;
const USDC_AMOUNT = Number(process.env.FAUCET_USDC ?? "1000"); // whole test-USDC per claim
const SOL_AMOUNT = Number(process.env.FAUCET_SOL ?? "0.05"); // SOL drip for fees (best-effort)
const ADMIN_MIN_SOL = Number(process.env.FAUCET_ADMIN_MIN_SOL ?? "0.3"); // keep this for keeper fees
const COOLDOWN_MS = Number(process.env.FAUCET_COOLDOWN_MS ?? String(60 * 60 * 1000)); // 1h / wallet

// Per-wallet cooldown (in-memory; resets on redeploy — fine for a devnet demo faucet).
const lastClaim = new Map<string, number>();

export interface FaucetResult {
  status: number;
  body: unknown;
}

/** Mint test USDC (+ a best-effort SOL drip) to `walletStr`. Rate-limited per wallet. */
export async function runFaucet(conn: Connection, admin: Keypair, walletStr: string): Promise<FaucetResult> {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletStr);
  } catch {
    return { status: 400, body: { error: "invalid wallet address" } };
  }

  const key = wallet.toBase58();
  const now = Date.now();
  const wait = (lastClaim.get(key) ?? 0) + COOLDOWN_MS - now;
  if (wait > 0) {
    return { status: 429, body: { error: "cooldown", retryAfterSec: Math.ceil(wait / 1000) } };
  }

  // Mint test USDC into the wallet's ATA (admin = mint authority).
  const mint = new PublicKey(USDC_MINT);
  let usdcSig: string;
  try {
    const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, wallet);
    const raw = BigInt(Math.round(USDC_AMOUNT)) * 10n ** BigInt(USDC_DECIMALS);
    usdcSig = await mintTo(conn, admin, mint, ata.address, admin, raw);
  } catch (e) {
    return { status: 502, body: { error: "mint failed: " + (e as Error).message } };
  }

  // Best-effort SOL drip so a fresh wallet can pay tx fees. Skipped if admin is low
  // (the keeper needs SOL to keep rebalancing) or if the transfer fails.
  let solSig: string | null = null;
  try {
    const adminSol = (await conn.getBalance(admin.publicKey)) / LAMPORTS_PER_SOL;
    if (SOL_AMOUNT > 0 && adminSol > ADMIN_MIN_SOL + SOL_AMOUNT) {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: wallet,
          lamports: Math.round(SOL_AMOUNT * LAMPORTS_PER_SOL),
        }),
      );
      solSig = await sendAndConfirmTransaction(conn, tx, [admin]);
    }
  } catch {
    /* SOL drip is best-effort — USDC mint already succeeded */
  }

  lastClaim.set(key, now);
  return {
    status: 200,
    body: { ok: true, usdc: USDC_AMOUNT, sol: solSig ? SOL_AMOUNT : 0, usdcSig, solSig },
  };
}
