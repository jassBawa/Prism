import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { basketMintPda, basketPda, ownerAta } from "../sdk/src/pdas.js";
import { createBasketRemaining, depositRemaining } from "../sdk/src/accounts.js";
import { loadBasketsConfig, pickBasket, pk } from "../sdk/src/config.js";
import { sendWithPyth } from "../sdk/src/pyth.js";

let pass = 0;
let fail = 0;

async function expectFail(label: string, code: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`  ✗ ${label}: expected ${code} but it SUCCEEDED`);
    fail++;
  } catch (e) {
    const err = e as { message?: string; logs?: string[]; error?: unknown };
    const s = [err.message, JSON.stringify(err.error ?? ""), (err.logs ?? []).join(" ")].join(" ");
    if (s.includes(code)) {
      console.log(`  ✓ ${label} → ${code}`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: expected ${code}, got: ${(err.message ?? "").slice(0, 140)}`);
      fail++;
    }
  }
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  const creator = admin.publicKey;
  const cfg = loadBasketsConfig();
  const usdc = cfg.mints.usdc!;
  const sol = cfg.mints.sol!;

  console.log("negative tests — every guard must REJECT:\n");

  const tryCreate = (id: number, mints: PublicKey[], weights: number[], quoteIndex: number) => {
    const basket = basketPda(creator, id);
    return program.methods
      .createBasket(new BN(id), mints.length, quoteIndex, weights, 100, new BN(30))
      .accountsPartial({
        creator,
        basket,
        basketMint: basketMintPda(basket),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .remainingAccounts(createBasketRemaining(basket, mints))
      .rpc();
  };

  // 1. a mint that was never allowlisted
  const stranger = await createMint(conn, admin, admin.publicKey, null, 6);
  await expectFail("non-allowlisted mint", "AssetNotSupported", () => tryCreate(90, [pk(sol), stranger], [5000, 5000], 1));

  // 2. weights that don't sum to 10000
  await expectFail("weights != 10000", "BadWeights", () => tryCreate(91, [pk(sol), pk(usdc)], [5000, 4000], 1));

  // 3. the same mint twice
  await expectFail("duplicate asset", "DuplicateAsset", () => tryCreate(92, [pk(usdc), pk(usdc)], [5000, 5000], 0));

  // 4. a non-stable as the quote asset
  await expectFail("non-stable quote (SOL)", "QuoteNotEligible", () => tryCreate(93, [pk(sol), pk(usdc)], [6000, 4000], 0));

  // 5. a substituted vault account in deposit's remaining_accounts
  const b = pickBasket(cfg);
  const basket = pk(b.basket);
  const quote = b.assets[b.quoteIndex]!;
  const depositorBasket = getAssociatedTokenAddressSync(pk(b.basketMint), creator);
  const depositorQuote = ownerAta(creator, pk(quote.mint));
  await expectFail("substituted vault (deposit)", "BadVault", () =>
    sendWithPyth(conn, admin, b.assets.map((a) => a.feed), (priceFor) => {
      const rem = depositRemaining(basket, b.assets, priceFor);
      rem[0] = { pubkey: pk(b.basketMint), isSigner: false, isWritable: true }; // wrong account for vault[0]
      return program.methods
        .deposit(new BN(1_000_000))
        .accountsPartial({ basket, basketMint: pk(b.basketMint), depositor: creator, depositorQuote, depositorBasket, tokenProgram: TOKEN_PROGRAM_ID })
        .remainingAccounts(rem)
        .instruction();
    }),
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
