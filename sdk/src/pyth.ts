import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, type Connection, type Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { feedId0x } from "./constants.js";

const HERMES_URL = "https://hermes.pyth.network";

/** Latest prices as micro-USD per whole token, keyed by feed hex (no 0x). */
export async function latestPricesMicro(feedsHex: string[]): Promise<Record<string, number>> {
  const hermes = new HermesClient(HERMES_URL, {});
  const res = await hermes.getLatestPriceUpdates(feedsHex.map(feedId0x), { parsed: true });
  const out: Record<string, number> = {};
  for (const p of res.parsed ?? []) {
    out[p.id] = Number(p.price.price) * 10 ** (p.price.expo + 6); // p.id is hex without 0x
  }
  return out;
}

export type PriceFor = (feedHex: string) => PublicKey;

/**
 * Pull-oracle flow: fetch fresh updates for `feedsHex` from Hermes, post them with
 * `addPostPartiallyVerifiedPriceUpdates` (postUpdateAtomic — fits in ONE tx with the
 * consumer ix), then build the program instruction against the ephemeral price
 * accounts (looked up via `priceFor(feedHex)`). A compute-unit bump is prepended for
 * the N-asset rebalance. `closeUpdateAccounts` reclaims rent each call (keeper-safe).
 * Atomic-post caps at ~4 feeds before the 1232-byte tx limit.
 */
export async function sendWithPyth(
  connection: Connection,
  kp: Keypair,
  feedsHex: string[],
  buildIx: (priceFor: PriceFor) => Promise<TransactionInstruction>,
): Promise<string[]> {
  const hermes = new HermesClient(HERMES_URL, {});
  const updates = await hermes.getLatestPriceUpdates(feedsHex.map(feedId0x), { encoding: "base64" });
  const data = updates.binary.data;

  const receiver = new PythSolanaReceiver({ connection, wallet: new Wallet(kp) as never });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPartiallyVerifiedPriceUpdates(data);
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount: (feedId: string) => PublicKey) => {
    const priceFor: PriceFor = (feedHex) => getPriceUpdateAccount(feedId0x(feedHex));
    const ix = await buildIx(priceFor);
    return [
      { instruction: ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), signers: [] },
      { instruction: ix, signers: [] },
    ];
  });

  // Send/confirm with our own web3.js-1.98 connection — the receiver's bundled
  // anchor-0.29 provider confirms via getTransaction without maxSupportedTransactionVersion
  // and throws on the v0 transactions.
  const built = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 50_000 });
  const sigs: string[] = [];
  for (const { tx, signers } of built) {
    tx.sign([kp, ...signers]);
    const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 5 });
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    sigs.push(sig);
  }
  return sigs;
}
