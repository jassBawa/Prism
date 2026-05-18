import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { ownerAta } from "../sdk/src/pdas.js";
import { withdrawRemaining } from "../sdk/src/accounts.js";

const AMOUNT = Number(process.argv[2] ?? "5"); // whole basket tokens
const BASKET_ARG = process.argv[3];

/** Withdraw: burn basket tokens, receive in-kind pro-rata of every asset (oracle-free). */
async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const b = pickBasket(loadBasketsConfig(), BASKET_ARG);
  const user = admin.publicKey;
  const basket = pk(b.basket);

  // make sure the user holds an ATA for every asset to receive into.
  for (const a of b.assets) await getOrCreateAssociatedTokenAccount(conn, admin, pk(a.mint), user);
  const userBasket = ownerAta(user, pk(b.basketMint));
  const amount = new BN(Math.round(AMOUNT * 1e6));

  console.log(`Withdrawing ${AMOUNT} basket tokens from "${b.label}" (in-kind, oracle-free)...`);
  const sig = await program.methods
    .withdraw(amount)
    .accountsPartial({ basket, basketMint: pk(b.basketMint), user, userBasket, tokenProgram: TOKEN_PROGRAM_ID })
    .remainingAccounts(withdrawRemaining(basket, user, b.assets))
    .rpc();
  console.log("✅ withdraw:", explorer("tx", sig));
}

main().catch((e) => {
  console.error("\nwithdraw failed:", e);
  process.exit(1);
});
