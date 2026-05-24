import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
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
  DEPOSIT_FEE_BPS,
  REBALANCE_INTERVAL_SECS,
  REBALANCE_SPREAD_BPS,
  REBALANCE_THRESHOLD_BPS,
  REBALANCE_THRESHOLD_REL_BPS,
  SUPPORTED_ASSETS,
  feedBytes,
  supportedByKey,
} from "../sdk/src/constants.js";
import {
  basketMintPda,
  basketPda,
  registryPda,
  supportedAssetPda,
  vaultAta,
} from "../sdk/src/pdas.js";
import { createBasketRemaining } from "../sdk/src/accounts.js";
import {
  saveBasketsConfig,
  type AssetEntry,
  type BasketEntry,
  type BasketsConfig,
} from "../sdk/src/config.js";

// Demo funds: name + description (on-chain) + assets + weights + quote key.
const BASKET_SPECS = [
  {
    label: "Blue-chip Index",
    description: "Diversified SOL, JUP and USDC exposure, rebalanced to a 50/30/20 target.",
    keys: ["sol", "jup", "usdc"],
    weights: [5000, 3000, 2000],
    quote: "usdc",
  },
  {
    label: "SOL Core 60/40",
    description: "A simple SOL-heavy fund with a USDC stable cushion, kept at 60/40.",
    keys: ["sol", "usdc"],
    weights: [6000, 4000],
    quote: "usdc",
  },
];

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const { program } = getProgram(admin, conn);
  console.log(
    "admin:",
    admin.publicKey.toBase58(),
    "| balance:",
    (await conn.getBalance(admin.publicKey)) / 1e9,
    "SOL",
  );

  // 1. Controlled mints for every supported asset (decimals from registry), admin = authority.
  console.log("\n[1] creating supported-asset mints...");
  const mint: Record<string, PublicKey> = {};
  for (const a of SUPPORTED_ASSETS) {
    const m = await createMint(conn, admin, admin.publicKey, null, a.decimals);
    mint[a.key] = m;
    console.log(`    ${a.key} (${a.decimals}dec): ${m.toBase58()}`);
  }

  // 2. Allowlist each (binds mint <-> Pyth feed <-> decimals on-chain).
  console.log("\n[2] set_supported_asset (on-chain allowlist)...");
  for (const a of SUPPORTED_ASSETS) {
    const m = mint[a.key]!;
    await program.methods
      .setSupportedAsset(feedBytes(a.feedHex), a.quoteEligible)
      .accountsPartial({
        admin: admin.publicKey,
        mint: m,
        supportedAsset: supportedAssetPda(m),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`    ${a.key} allowlisted (quoteEligible=${a.quoteEligible})`);
  }

  // 3. Fund admin: USDC for deposits + every asset as keeper reserve for mock-swap.
  console.log("\n[3] funding admin (deposit USDC + keeper reserves)...");
  for (const a of SUPPORTED_ASSETS) {
    const m = mint[a.key]!;
    const ata = await getOrCreateAssociatedTokenAccount(
      conn,
      admin,
      m,
      admin.publicKey,
    );
    const whole = a.key === "usdc" ? 2_000_000 : 200_000;
    await mintTo(
      conn,
      admin,
      m,
      ata.address,
      admin,
      BigInt(whole) * 10n ** BigInt(a.decimals),
    );
    console.log(`    minted ${whole} ${a.key}`);
  }

  // 3.5 Init the basket registry (one-time). On a re-seed after a program upgrade the
  // registry already exists — that's fine, skip it.
  console.log("\n[3.5] init_registry...");
  let idBase = 0;
  try {
    await program.methods
      .initRegistry()
      .accountsPartial({
        admin: admin.publicKey,
        registry: registryPda(),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  } catch {
    // Already initialized. Offset new basket ids past every existing entry so the
    // create_basket PDAs (seeded by creator+id) don't collide with prior baskets.
    const reg = (await program.account.registry.fetchNullable(registryPda())) as unknown as { count: number } | null;
    idBase = reg?.count ?? 0;
    console.log(`    registry exists (count=${idBase}) — new basket ids start at ${idBase}`);
  }

  // 4. Create the demo baskets.
  console.log(`\n[4] create_basket x${BASKET_SPECS.length}...`);
  const baskets: BasketEntry[] = [];
  for (let i = 0; i < BASKET_SPECS.length; i++) {
    const id = idBase + i;
    const spec = BASKET_SPECS[i]!;
    const basket = basketPda(admin.publicKey, id);
    const basketMint = basketMintPda(basket);
    const mints = spec.keys.map((k) => mint[k]!);
    const quoteIndex = spec.keys.indexOf(spec.quote);
    await program.methods
      .createBasket(
        new BN(id),
        spec.label,
        spec.description,
        spec.keys.length,
        quoteIndex,
        spec.weights,
        REBALANCE_THRESHOLD_BPS,
        REBALANCE_THRESHOLD_REL_BPS,
        REBALANCE_SPREAD_BPS,
        DEPOSIT_FEE_BPS,
        new BN(REBALANCE_INTERVAL_SECS),
      )
      .accountsPartial({
        creator: admin.publicKey,
        basket,
        basketMint,
        registry: registryPda(),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .remainingAccounts(createBasketRemaining(basket, mints))
      .rpc();
    // Pre-create the creator's basket-token ATA so deposits can route the fee to it.
    await getOrCreateAssociatedTokenAccount(
      conn,
      admin,
      basketMint,
      admin.publicKey,
    );
    const assets: AssetEntry[] = spec.keys.map((k, i) => ({
      key: k,
      mint: mint[k]!.toBase58(),
      feed: supportedByKey(k).feedHex,
      decimals: supportedByKey(k).decimals,
      weightBps: spec.weights[i]!,
    }));
    baskets.push({
      label: spec.label,
      creator: admin.publicKey.toBase58(),
      id,
      basket: basket.toBase58(),
      basketMint: basketMint.toBase58(),
      quoteIndex,
      thresholdBps: REBALANCE_THRESHOLD_BPS,
      thresholdRelBps: REBALANCE_THRESHOLD_REL_BPS,
      spreadBps: REBALANCE_SPREAD_BPS,
      feeBps: DEPOSIT_FEE_BPS,
      intervalSecs: REBALANCE_INTERVAL_SECS,
      assets,
      vaults: mints.map((m) => vaultAta(basket, m).toBase58()),
    });
    console.log(
      `    [${id}] ${spec.label}: ${basket.toBase58()} (${spec.keys.join("/")})`,
    );
  }

  const cfg: BasketsConfig = {
    programId: program.programId.toBase58(),
    mints: Object.fromEntries(
      SUPPORTED_ASSETS.map((a) => [a.key, mint[a.key]!.toBase58()]),
    ),
    baskets,
  };
  saveBasketsConfig(cfg);
  console.log("\n✅ Seeded", baskets.length, "baskets -> .keys/basket.json");
}

main().catch((e) => {
  console.error("\nseed failed:", e);
  process.exit(1);
});
