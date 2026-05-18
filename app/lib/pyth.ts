import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  ComputeBudgetProgram,
  type Connection,
  type PublicKey,
  type TransactionInstruction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { feedId0x } from "./constants";

const HERMES = "https://hermes.pyth.network";

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
async function hermesLatest(feedsHex: string[]): Promise<HermesLatest> {
  const ids = feedsHex.map((h) => `ids[]=0x${h}`).join("&");
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${ids}&encoding=base64&parsed=true`);
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  return res.json() as Promise<HermesLatest>;
}

/** Latest prices (USD per whole token) keyed by feed hex (no 0x). */
export async function latestPricesUsd(feedsHex: string[]): Promise<Record<string, number>> {
  const { parsed = [] } = await hermesLatest(feedsHex);
  const out: Record<string, number> = {};
  for (const p of parsed) out[p.id] = Number(p.price.price) * 10 ** p.price.expo; // p.id is hex no 0x
  return out;
}

export type PriceFor = (feedHex: string) => PublicKey;

/** Post fresh Pyth updates for `feedsHex` + consumer ix(s) in one bundle, signed by the wallet. */
export async function sendWithPyth(
  connection: Connection,
  wallet: SignerWallet,
  feedsHex: string[],
  buildIxs: (priceFor: PriceFor) => Promise<TransactionInstruction[]>,
): Promise<string[]> {
  const { binary } = await hermesLatest(feedsHex);

  const receiver = new PythSolanaReceiver({ connection, wallet: wallet as never });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPartiallyVerifiedPriceUpdates(binary.data);
  await builder.addPriceConsumerInstructions(async (get: (id: string) => PublicKey) => {
    const priceFor: PriceFor = (hex) => get(feedId0x(hex));
    const ixs = await buildIxs(priceFor);
    return [
      { instruction: ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), signers: [] },
      ...ixs.map((instruction) => ({ instruction, signers: [] })),
    ];
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
