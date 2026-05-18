import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { rebalanceRemaining } from "../sdk/src/accounts.js";
import { sendWithPyth } from "../sdk/src/pyth.js";

const BASKET_ARG = process.argv[2];

/** Keeper: rebalance one basket toward target weights via an oracle-priced mock-swap. */
async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const b = pickBasket(loadBasketsConfig(), BASKET_ARG);
  const keeper = admin.publicKey;
  const basket = pk(b.basket);

  console.log(`Rebalancing "${b.label}" (keeper)...`);
  const feeds = b.assets.map((a) => a.feed);
  const sigs = await sendWithPyth(conn, admin, feeds, (priceFor) =>
    program.methods
      .rebalance()
      .accountsPartial({ basket, keeper, tokenProgram: TOKEN_PROGRAM_ID })
      .remainingAccounts(rebalanceRemaining(basket, keeper, b.assets, priceFor))
      .instruction(),
  );
  console.log("✅ rebalanced:", sigs.map((s) => explorer("tx", s)).join("\n   "));
}

main().catch((e) => {
  console.error("\nrebalance failed:", e);
  process.exit(1);
});
