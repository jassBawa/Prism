import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { TxVersion, getCpmmPdaAmmConfigId } from "@raydium-io/raydium-sdk-v2";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { SUPPORTED_ASSETS, explorer } from "../sdk/src/constants.js";
import { loadBasketsConfig, loadPoolsConfig, savePoolsConfig, pk, type PoolEntry } from "../sdk/src/config.js";
import { latestPricesMicro } from "../sdk/src/pyth.js";
import { loadRaydium, cpmmIds } from "../sdk/src/raydium.js";

// One CPMM pool per (USDC, asset) pair. Seeded at ~Pyth price with ~USDC_DEPTH depth so a
// few-hundred-USDC trade is < ~1% of the pool. Admin is mint authority → can fund both sides.
const PAIRS = ["sol", "jup", "bonk"];
const USDC_DEPTH = 50_000;

const decimalsOf = (key: string) => SUPPORTED_ASSETS.find((a) => a.key === key)!.decimals;
const feedOf = (key: string) => SUPPORTED_ASSETS.find((a) => a.key === key)!.feedHex;

async function fund(conn: any, admin: any, mint: PublicKey, whole: number, decimals: number) {
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey);
  await mintTo(conn, admin, mint, ata.address, admin, BigInt(Math.ceil(whole)) * 10n ** BigInt(decimals));
}

async function main() {
  const conn = getConnection();
  const admin = loadKeypair();
  const cfg = loadBasketsConfig();
  const pools = loadPoolsConfig();
  const { program, feeAcc, ammConfig } = cpmmIds();

  console.log("admin:", admin.publicKey.toBase58(), "| CPMM program:", program.toBase58());
  const raydium = await loadRaydium(conn, admin);

  const feeConfigs = await raydium.api.getCpmmConfigs();
  feeConfigs.forEach((c: any) => {
    c.id = getCpmmPdaAmmConfigId(program, c.index).publicKey.toBase58();
  });
  const feeConfig = feeConfigs[0];

  const usdcMint = pk(cfg.mints["usdc"]!);
  const prices = await latestPricesMicro([feedOf("usdc"), ...PAIRS.map(feedOf)]);

  pools.cpmmProgram = program.toBase58();
  pools.cpmmFeeAcc = feeAcc.toBase58();
  pools.ammConfig = ammConfig.toBase58();

  for (const key of PAIRS) {
    const poolKey = `usdc-${key}`;
    if (pools.pools[poolKey]?.poolId) {
      console.log(`  ↷ ${poolKey} exists (${pools.pools[poolKey].poolId}) — skip`);
      continue;
    }
    const assetMint = pk(cfg.mints[key]!);
    const dec = decimalsOf(key);
    const priceUsd = (prices[feedOf(key)] ?? 0) / 1e6;
    if (priceUsd <= 0) throw new Error(`no price for ${key}`);
    const assetWhole = USDC_DEPTH / priceUsd;

    console.log(`\n[${poolKey}] seeding ${USDC_DEPTH} USDC + ${assetWhole.toFixed(2)} ${key} (~$${priceUsd})`);
    await fund(conn, admin, usdcMint, USDC_DEPTH, 6);
    await fund(conn, admin, assetMint, assetWhole * 1.05, dec);

    const mintA = { address: usdcMint.toBase58(), decimals: 6, programId: TOKEN_PROGRAM_ID.toBase58() };
    const mintB = { address: assetMint.toBase58(), decimals: dec, programId: TOKEN_PROGRAM_ID.toBase58() };

    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: program,
      poolFeeAccount: feeAcc,
      mintA,
      mintB,
      mintAAmount: new BN(Math.round(USDC_DEPTH * 1e6)),
      mintBAmount: new BN(new BN(Math.ceil(assetWhole)).mul(new BN(10).pow(new BN(dec)))),
      startTime: new BN(0),
      feeConfig,
      associatedOnly: false,
      ownerInfo: { useSOLBalance: true },
      txVersion: TxVersion.V0,
    });
    const { txId } = await execute({ sendAndConfirm: true });
    console.log("  created:", explorer("tx", txId));

    const a = extInfo.address as any;
    const entry: PoolEntry = {
      poolId: a.poolId.toString(),
      token0Mint: a.mintA.address?.toString?.() ?? a.mintA.toString(),
      token1Mint: a.mintB.address?.toString?.() ?? a.mintB.toString(),
      vault0: a.vaultA.toString(),
      vault1: a.vaultB.toString(),
      observation: a.observationId.toString(),
      authority: a.authority.toString(),
      lpMint: a.lpMint?.address?.toString?.() ?? a.lpMint?.toString?.() ?? "",
      configId: a.configId.toString(),
    };
    pools.pools[poolKey] = entry;
    savePoolsConfig(pools);
    console.log("  pool:", entry.poolId);
  }

  console.log("\n✅ pools ready -> .keys/pools.json");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
