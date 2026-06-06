import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { intentPda } from "../sdk/src/pdas.js";
import { fetchIntent } from "../sdk/src/intents.js";

// End-to-end test of the Intents (time-locked param change) feature on devnet.
// Proves: propose → activate reverts before the lock → activate applies after →
// basket param updated on-chain + intent closed → cancel closes a fresh proposal.
const DELAY = 60;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
};

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const b = pickBasket(loadBasketsConfig(), undefined);
  const basket = pk(b.basket);

  const cur = await program.account.basket.fetch(basket);
  const origFee = cur.depositFeeBps;
  const newFee = origFee === 50 ? 60 : 50; // a visibly different, valid fee
  const params = [
    cur.rebalanceThresholdBps,
    cur.rebalanceThresholdRelBps,
    new BN(cur.rebalanceIntervalSecs.toString()),
    cur.rebalanceSpreadBps,
  ] as const;
  console.log(`Basket "${b.label}" current deposit_fee_bps = ${origFee}; will propose ${newFee}.`);

  // 1) propose
  await program.methods
    .proposeIntent(params[0], params[1], params[2], params[3], newFee, new BN(DELAY))
    .accountsPartial({ basket, authority: admin.publicKey, intent: intentPda(basket), systemProgram: SystemProgram.programId })
    .rpc();
  const it = await fetchIntent(program, basket);
  assert(!!it, "intent should exist after propose");
  assert(it!.depositFeeBps === newFee, `intent fee ${it!.depositFeeBps} != ${newFee}`);
  console.log(`✅ proposed — activate_ts=${new Date(it!.activateTs * 1000).toISOString()} (in ~${DELAY}s)`);

  // 2) activate before the lock elapses → must revert IntentNotReady
  try {
    await program.methods
      .activateIntent()
      .accountsPartial({ basket, intent: intentPda(basket), activator: admin.publicKey })
      .rpc();
    throw new Error("activate should have reverted before the time-lock");
  } catch (e) {
    const msg = (e as Error).message;
    assert(/IntentNotReady/.test(msg), `expected IntentNotReady, got: ${msg}`);
    console.log("✅ early activate correctly reverted: IntentNotReady");
  }

  // 3) wait out the lock, then activate (permissionless)
  console.log(`waiting ${DELAY + 3}s for the time-lock…`);
  await sleep(DELAY + 3);
  await program.methods
    .activateIntent()
    .accountsPartial({ basket, intent: intentPda(basket), activator: admin.publicKey })
    .rpc();
  const after = await program.account.basket.fetch(basket);
  assert(after.depositFeeBps === newFee, `basket fee ${after.depositFeeBps} != ${newFee} after activate`);
  assert((await fetchIntent(program, basket)) === null, "intent should be closed after activate");
  console.log(`✅ activated — basket deposit_fee_bps = ${after.depositFeeBps}, intent closed (rent returned)`);

  // 4) cancel path: propose a fresh change (restoring orig fee), then cancel it
  await program.methods
    .proposeIntent(params[0], params[1], params[2], params[3], origFee, new BN(DELAY))
    .accountsPartial({ basket, authority: admin.publicKey, intent: intentPda(basket), systemProgram: SystemProgram.programId })
    .rpc();
  assert(!!(await fetchIntent(program, basket)), "intent should exist before cancel");
  await program.methods
    .cancelIntent()
    .accountsPartial({ basket, authority: admin.publicKey, intent: intentPda(basket) })
    .rpc();
  assert((await fetchIntent(program, basket)) === null, "intent should be closed after cancel");
  console.log("✅ cancel closed the pending intent");

  // 5) restore original fee via a full propose→wait→activate cycle (leave state clean)
  await program.methods
    .proposeIntent(params[0], params[1], params[2], params[3], origFee, new BN(DELAY))
    .accountsPartial({ basket, authority: admin.publicKey, intent: intentPda(basket), systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`restoring fee to ${origFee}: waiting ${DELAY + 3}s…`);
  await sleep(DELAY + 3);
  await program.methods
    .activateIntent()
    .accountsPartial({ basket, intent: intentPda(basket), activator: admin.publicKey })
    .rpc();
  const restored = await program.account.basket.fetch(basket);
  assert(restored.depositFeeBps === origFee, `fee not restored: ${restored.depositFeeBps} != ${origFee}`);
  console.log(`✅ restored — basket deposit_fee_bps = ${restored.depositFeeBps}`);

  console.log("\n🎉 Intents E2E passed.");
}

main().catch((e) => {
  console.error("\nE2E failed:", e);
  process.exit(1);
});
