import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pk } from "../sdk/src/config.js";

// Fund a wallet for the dashboard demo: airdrop SOL + mint test USDC.
//   pnpm run faucet <pubkey> [usdc]
const target = process.argv[2];
const usdcWhole = Number(process.argv[3] ?? "1000");

async function main() {
  if (!target) {
    console.error("usage: pnpm run faucet <pubkey> [usdc]");
    process.exit(1);
  }
  const conn = getConnection();
  const admin = loadKeypair();
  const cfg = loadBasketsConfig();
  const owner = new PublicKey(target);

  await conn.requestAirdrop(owner, 5_000_000_000).catch(() => {});
  const usdcMint = pk(cfg.mints.usdc!);
  const ata = await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, owner);
  await mintTo(conn, admin, usdcMint, ata.address, admin, BigInt(usdcWhole) * 1_000_000n);

  console.log(`funded ${target}: ~5 SOL + ${usdcWhole} test USDC`);
}

main().catch((e) => {
  console.error("faucet failed:", e);
  process.exit(1);
});
