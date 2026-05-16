import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketConfig, pk } from "../sdk/src/config.js";

const AMOUNT = Number(process.argv[2] ?? "5"); // whole basket tokens

/** Withdraw: burn basket tokens, receive in-kind pro-rata of every asset (oracle-free). */
async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketConfig();
  const user = admin.publicKey;

  const userBasket = getAssociatedTokenAddressSync(pk(cfg.basketMint), user);
  const userSol = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(cfg.mints.sol), user)).address;
  const userJup = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(cfg.mints.jup), user)).address;
  const userUsdc = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(cfg.mints.usdc), user)).address;
  const amount = new BN(Math.round(AMOUNT * 1e6));

  console.log(`Withdrawing ${AMOUNT} basket tokens (in-kind, oracle-free)...`);
  const sig = await program.methods
    .withdraw(amount)
    .accountsPartial({
      basket: pk(cfg.basket),
      basketMint: pk(cfg.basketMint),
      user,
      userBasket,
      vaultSol: pk(cfg.vaults.sol),
      vaultJup: pk(cfg.vaults.jup),
      vaultUsdc: pk(cfg.vaults.usdc),
      userSol,
      userJup,
      userUsdc,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("✅ withdraw:", explorer("tx", sig));
}

main().catch((e) => {
  console.error("\nwithdraw failed:", e);
  process.exit(1);
});
