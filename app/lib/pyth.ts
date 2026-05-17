import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { Connection, PublicKey, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { ASSETS, FEED_HEX } from "./constants";

const HERMES = "https://hermes.pyth.network";

export interface PriceAccounts {
  sol: PublicKey;
  jup: PublicKey;
  usdc: PublicKey;
}

export interface SignerWallet {
  publicKey: PublicKey;
  signTransaction<T extends VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends VersionedTransaction>(txs: T[]): Promise<T[]>;
}

interface HermesLatest {
  binary: { data: string[] };
  parsed?: { id: string; price: { price: string; expo: number } }[];
}

/** Hermes REST (avoids the hermes-client SSE dep that breaks the webpack build). */
async function hermesLatest(): Promise<HermesLatest> {
  const ids = [FEED_HEX.sol, FEED_HEX.jup, FEED_HEX.usdc].map((h) => `ids[]=0x${h}`).join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${ids}&encoding=base64&parsed=true`);
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  return res.json() as Promise<HermesLatest>;
}

/** Latest prices (USD per whole token) for display + off-chain drift. */
export async function latestPricesUsd(): Promise<Record<string, number>> {
  const { parsed = [] } = await hermesLatest();
  const out: Record<string, number> = {};
  for (const p of parsed) out[p.id] = Number(p.price.price) * 10 ** p.price.expo;
  return { sol: out[FEED_HEX.sol] ?? 0, jup: out[FEED_HEX.jup] ?? 0, usdc: out[FEED_HEX.usdc] ?? 0 };
}

/** Post fresh Pyth updates + consumer ix(s) in one bundle, signed by the wallet. */
export async function sendWithPyth(
  connection: Connection,
  wallet: SignerWallet,
  buildIxs: (price: PriceAccounts) => Promise<TransactionInstruction[]>,
): Promise<string[]> {
  const { binary } = await hermesLatest();

  const receiver = new PythSolanaReceiver({ connection, wallet: wallet as never });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPartiallyVerifiedPriceUpdates(binary.data);
  await builder.addPriceConsumerInstructions(async (get) => {
    const feed0x = (k: keyof typeof FEED_HEX) => "0x" + FEED_HEX[k];
    const ixs = await buildIxs({ sol: get(feed0x("sol")), jup: get(feed0x("jup")), usdc: get(feed0x("usdc")) });
    return ixs.map((instruction) => ({ instruction, signers: [] }));
  });

  const built = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 50_000 });
  const sigs: string[] = [];
  for (const { tx, signers } of built) {
    if (signers.length) tx.sign(signers);
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
    await connection.confirmTransaction(sig, "confirmed");
    sigs.push(sig);
  }
  return sigs;
}

export { ASSETS };
