import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection, getProgram, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pk } from "../sdk/src/config.js";

// Mint the demo funds' underlying TEST tokens to a wallet so it can deposit.
// usage: RPC_URL=… pnpm fund-wallet <walletAddress> [amountEach=1000]
// (The fund's "SOL"/"USDC" are admin-minted SPL test tokens — NOT native SOL.)
const TARGET = process.argv[2];
const AMOUNT = Number(process.argv[3] ?? "1000");
const DECIMALS: Record<string, number> = { sol: 9, jup: 6, bonk: 5, usdc: 6 };

async function main() {
  if (!TARGET) throw new Error("usage: pnpm fund-wallet <walletAddress> [amountEach]");
  const conn = getConnection();
  const admin = loadKeypair(); // mint authority on the test mints
  getProgram(admin, conn); // validates config/keypair
  const owner = new PublicKey(TARGET);
  const { mints } = loadBasketsConfig();

  console.log(`funding ${TARGET} with ${AMOUNT} of each test token…`);
  for (const [key, mintStr] of Object.entries(mints)) {
    const decimals = DECIMALS[key] ?? 6;
    const ata = await getOrCreateAssociatedTokenAccount(conn, admin, pk(mintStr), owner);
    await mintTo(conn, admin, pk(mintStr), ata.address, admin, Math.round(AMOUNT * 10 ** decimals));
    console.log(`  ✓ ${AMOUNT} ${key.toUpperCase()} -> ${ata.address.toBase58()}`);
  }
  console.log("done — refresh the app to see balances.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  });
