import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import {
  ASSETS,
  REBALANCE_INTERVAL_SECS,
  REBALANCE_THRESHOLD_BPS,
  explorer,
  feedBytes,
  type AssetKey,
} from "../sdk/src/constants.js";
import { basketPda, vaultAta } from "../sdk/src/pdas.js";

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  console.log("admin:", admin.publicKey.toBase58(), "| balance:", (await conn.getBalance(admin.publicKey)) / 1e9, "SOL");

  // 1. Three controlled mints (decimals 9/6/6), admin = mint authority.
  console.log("\n[1] creating asset mints (9/6/6)...");
  const mint = {} as Record<AssetKey, PublicKey>;
  for (const a of ASSETS) {
    mint[a.key] = await createMint(conn, admin, admin.publicKey, null, a.decimals);
    console.log(`    ${a.key} (${a.decimals}dec): ${mint[a.key].toBase58()}`);
  }

  // 2. initialize_basket (program inits the Basket PDA, basket mint, and 3 vault ATAs).
  console.log("\n[2] initialize_basket...");
  const basket = basketPda();
  const basketMint = Keypair.generate();
  await program.methods
    .initializeBasket(
      ASSETS.map((a) => a.weightBps),
      ASSETS.map((a) => feedBytes(a.key)),
      REBALANCE_THRESHOLD_BPS,
      new BN(REBALANCE_INTERVAL_SECS),
    )
    .accountsPartial({
      authority: admin.publicKey,
      basket,
      basketMint: basketMint.publicKey,
      solMint: mint.sol,
      jupMint: mint.jup,
      usdcMint: mint.usdc,
      vaultSol: vaultAta(mint.sol),
      vaultJup: vaultAta(mint.jup),
      vaultUsdc: vaultAta(mint.usdc),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([basketMint])
    .rpc();
  console.log("    basket:", basket.toBase58(), "| basketMint:", basketMint.publicKey.toBase58());

  // 3. Mint asset tokens to admin: USDC = deposit source; SOL/JUP = keeper reserve for mock-swap.
  console.log("\n[3] funding admin (USDC for deposits, SOL/JUP as keeper reserve)...");
  for (const a of ASSETS) {
    const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint[a.key], admin.publicKey);
    const whole = a.key === "usdc" ? 1_000_000 : 100_000;
    await mintTo(conn, admin, mint[a.key], ata.address, admin, BigInt(whole) * 10n ** BigInt(a.decimals));
    console.log(`    minted ${whole} ${a.key} to admin`);
  }

  // 4. Save config for deposit/withdraw/keeper.
  const cfg = {
    programId: program.programId.toBase58(),
    basket: basket.toBase58(),
    basketMint: basketMint.publicKey.toBase58(),
    mints: Object.fromEntries(ASSETS.map((a) => [a.key, mint[a.key].toBase58()])),
    vaults: Object.fromEntries(ASSETS.map((a) => [a.key, vaultAta(mint[a.key]).toBase58()])),
  };
  writeFileSync(resolve(process.cwd(), ".keys/basket.json"), JSON.stringify(cfg, null, 2));
  console.log("\n✅ Basket seeded on devnet. Config -> .keys/basket.json");
  console.log("Basket:", explorer("address", basket.toBase58()));
}

main().catch((e) => {
  console.error("\nseed failed:", e);
  process.exit(1);
});
