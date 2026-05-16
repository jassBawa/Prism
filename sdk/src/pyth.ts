import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import type { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { feedId0x } from "./constants.js";

const HERMES_URL = "https://hermes.pyth.network";

export interface PriceAccounts {
  sol: PublicKey;
  jup: PublicKey;
  usdc: PublicKey;
}

/**
 * Pull-oracle flow: fetch fresh SOL/JUP/USDC updates from Hermes, post them with
 * `addPostPartiallyVerifiedPriceUpdates` (postUpdateAtomic — fits in ONE tx with the
 * consumer ix), then build the program instruction against the ephemeral price
 * accounts. `closeUpdateAccounts` reclaims the rent each call (keeper-safe).
 */
export async function sendWithPyth(
  connection: Connection,
  kp: Keypair,
  buildIx: (price: PriceAccounts) => Promise<TransactionInstruction>,
): Promise<string[]> {
  const hermes = new HermesClient(HERMES_URL, {});
  const feeds = [feedId0x("sol"), feedId0x("jup"), feedId0x("usdc")];
  const updates = await hermes.getLatestPriceUpdates(feeds, { encoding: "base64" });
  const data = updates.binary.data;

  const receiver = new PythSolanaReceiver({ connection, wallet: new Wallet(kp) as never });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPartiallyVerifiedPriceUpdates(data);
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
    const ix = await buildIx({
      sol: getPriceUpdateAccount(feedId0x("sol")),
      jup: getPriceUpdateAccount(feedId0x("jup")),
      usdc: getPriceUpdateAccount(feedId0x("usdc")),
    });
    return [{ instruction: ix, signers: [] }];
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
