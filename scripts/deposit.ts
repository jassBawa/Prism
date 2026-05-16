import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketConfig, pk, uiBalance } from "../sdk/src/config.js";
import { sendWithPyth } from "../sdk/src/pyth.js";

const USDC = Number(process.argv[2] ?? "10"); // whole USDC

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketConfig();
  const depositor = admin.publicKey;

  const depositorBasket = (await getOrCreateAssociatedTokenAccount(conn, admin, pk(cfg.basketMint), depositor)).address;
  const depositorUsdc = getAssociatedTokenAddressSync(pk(cfg.mints.usdc), depositor);
  const amount = new BN(Math.round(USDC * 1e6));

  const basketBal = async (): Promise<number> => {
    try {
      return (await conn.getTokenAccountBalance(depositorBasket)).value.uiAmount ?? 0;
    } catch {
      return 0;
    }
  };
  console.log(`Depositing ${USDC} USDC...`);
  const before = await basketBal();

  const sigs = await sendWithPyth(conn, admin, (price) =>
    program.methods
      .deposit(amount)
      .accountsPartial({
        basket: pk(cfg.basket),
        basketMint: pk(cfg.basketMint),
        depositor,
        depositorUsdc,
        depositorBasket,
        vaultSol: pk(cfg.vaults.sol),
        vaultJup: pk(cfg.vaults.jup),
        vaultUsdc: pk(cfg.vaults.usdc),
        priceSol: price.sol,
        priceJup: price.jup,
        priceUsdc: price.usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );

  console.log("tx:", sigs.map((s) => explorer("tx", s)).join("\n    "));
  const after = await basketBal();
  console.log(`basket token: ${before} -> ${after}`);
  if (after > before) console.log("\n✅ DEPOSIT — basket token minted by NAV (Pyth-priced) on devnet.");
}

main().catch((e) => {
  console.error("\ndeposit failed:", e);
  process.exit(1);
});
