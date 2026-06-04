import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pickBasket, pk, type BasketEntry } from "../sdk/src/config.js";
import { rebalanceRemaining } from "../sdk/src/accounts.js";
import { sendWithPyth } from "../sdk/src/pyth.js";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, Keypair } from "@solana/web3.js";
import type { MiniSymmetry } from "../sdk/src/mini_symmetry.js";

const BASKET_ARG = process.argv[2];

/** Rebalance one basket toward target weights via an oracle-priced mock-swap. */
async function rebalanceOne(
  conn: Connection,
  program: Program<MiniSymmetry>,
  admin: Keypair,
  b: BasketEntry,
): Promise<void> {
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

/** `pnpm rebalance` → first basket; `pnpm rebalance <pubkey>` → that one;
 *  `pnpm rebalance all` → every config basket (the program still enforces the
 *  drift + interval gate per fund — ineligible ones are skipped, not forced). */
async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const cfg = loadBasketsConfig();

  if (BASKET_ARG === "all") {
    let ok = 0;
    for (const b of cfg.baskets) {
      try {
        await rebalanceOne(conn, program, admin, b);
        ok++;
      } catch (e) {
        // DriftBelowThreshold / IntervalNotElapsed → not due yet, keep going.
        console.log(`↷ skipped "${b.label}": ${(e as Error).message.split("\n")[0]}`);
      }
    }
    console.log(`\nrebalanced ${ok}/${cfg.baskets.length} basket(s).`);
    return;
  }

  await rebalanceOne(conn, program, admin, pickBasket(cfg, BASKET_ARG));
}

main().catch((e) => {
  console.error("\nrebalance failed:", e);
  process.exit(1);
});
