import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { ownerAta } from "../sdk/src/pdas.js";
import { depositRemaining } from "../sdk/src/accounts.js";
import { sendWithPyth } from "../sdk/src/pyth.js";

const AMOUNT = Number(process.argv[2] ?? "10"); // whole quote tokens (e.g. USDC)
const BASKET_ARG = process.argv[3]; // optional basket pubkey (defaults to first)

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const b = pickBasket(loadBasketsConfig(), BASKET_ARG);
  const depositor = admin.publicKey;
  const basket = pk(b.basket);
  const quote = b.assets[b.quoteIndex]!;

  const depositorBasket = (
    await getOrCreateAssociatedTokenAccount(
      conn,
      admin,
      pk(b.basketMint),
      depositor,
    )
  ).address;
  // Creator's basket-token ATA receives the deposit fee; ensure it exists.
  const creatorBasket = (
    await getOrCreateAssociatedTokenAccount(
      conn,
      admin,
      pk(b.basketMint),
      pk(b.creator),
    )
  ).address;
  const depositorQuote = ownerAta(depositor, pk(quote.mint));
  const amount = new BN(Math.round(AMOUNT * 10 ** quote.decimals));

  const basketBal = async (): Promise<number> => {
    try {
      return (
        (await conn.getTokenAccountBalance(depositorBasket)).value.uiAmount ?? 0
      );
    } catch {
      return 0;
    }
  };
  console.log(
    `Depositing ${AMOUNT} ${quote.key.toUpperCase()} into "${b.label}"...`,
  );
  const before = await basketBal();

  const feeds = b.assets.map((a) => a.feed);
  const sigs = await sendWithPyth(conn, admin, feeds, (priceFor) =>
    program.methods
      .deposit(amount)
      .accountsPartial({
        basket,
        basketMint: pk(b.basketMint),
        depositor,
        depositorQuote,
        depositorBasket,
        creatorBasket,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(depositRemaining(basket, b.assets, priceFor))
      .instruction(),
  );

  console.log("tx:", sigs.map((s) => explorer("tx", s)).join("\n    "));
  const after = await basketBal();
  console.log(`basket token: ${before} -> ${after}`);
  if (after > before)
    console.log("\n✅ DEPOSIT — basket token minted by NAV (Pyth-priced).");
}

main().catch((e) => {
  console.error("\ndeposit failed:", e);
  process.exit(1);
});
