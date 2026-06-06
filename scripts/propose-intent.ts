import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { intentPda } from "../sdk/src/pdas.js";
import { fetchIntent } from "../sdk/src/intents.js";

// Propose a time-locked param change. Default: set deposit fee to 1% (100 bps),
// activatable after 60s. Keeps the other params at their current values.
const FEE_BPS = Number(process.argv[2] ?? "100");
const DELAY = Number(process.argv[3] ?? "60");
const BASKET_ARG = process.argv[4];

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const b = pickBasket(loadBasketsConfig(), BASKET_ARG);
  const basket = pk(b.basket);

  console.log(
    `Proposing on "${b.label}": deposit_fee_bps ${b.feeBps} -> ${FEE_BPS}, activates in ${DELAY}s`,
  );
  const sig = await program.methods
    .proposeIntent(b.thresholdBps, b.thresholdRelBps, new BN(b.intervalSecs), b.spreadBps, FEE_BPS, new BN(DELAY))
    .accountsPartial({
      basket,
      authority: admin.publicKey,
      intent: intentPda(basket),
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("tx:", explorer("tx", sig));
  const it = await fetchIntent(program, basket);
  console.log("pending intent:", it ? { fee: it.depositFeeBps, activateTs: it.activateTs } : "none");
  console.log(`\n✅ proposed — activatable at ${new Date(it!.activateTs * 1000).toISOString()} (keeper/anyone activates after that).`);
}

main().catch((e) => {
  console.error("\npropose failed:", e);
  process.exit(1);
});
