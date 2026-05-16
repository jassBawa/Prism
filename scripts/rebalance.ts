import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketConfig, pk } from "../sdk/src/config.js";
import { sendWithPyth } from "../sdk/src/pyth.js";

/** Keeper: rebalance the basket toward target weights via an oracle-priced mock-swap. */
async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketConfig();
  const keeper = admin.publicKey;
  const reserve = (mint: string) => getAssociatedTokenAddressSync(pk(mint), keeper);

  console.log("Rebalancing (keeper)...");
  const sigs = await sendWithPyth(conn, admin, (price) =>
    program.methods
      .rebalance()
      .accountsPartial({
        basket: pk(cfg.basket),
        keeper,
        vaultSol: pk(cfg.vaults.sol),
        vaultJup: pk(cfg.vaults.jup),
        vaultUsdc: pk(cfg.vaults.usdc),
        reserveSol: reserve(cfg.mints.sol),
        reserveJup: reserve(cfg.mints.jup),
        reserveUsdc: reserve(cfg.mints.usdc),
        priceSol: price.sol,
        priceJup: price.jup,
        priceUsdc: price.usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );
  console.log("✅ rebalanced:", sigs.map((s) => explorer("tx", s)).join("\n   "));
}

main().catch((e) => {
  console.error("\nrebalance failed:", e);
  process.exit(1);
});
