import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  createUpdateMetadataAccountV2Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { getConnection, loadKeypair } from "../sdk/src/client.js";
import { loadBasketsConfig, pk } from "../sdk/src/config.js";
import { explorer } from "../sdk/src/constants.js";

// Give the play-money test mints real names/symbols/logos so wallets show
// "Test SOL (tSOL)" + an icon instead of a raw mint address.
// usage: RPC_URL=… pnpm token-metadata
const RAW = "https://raw.githubusercontent.com/jassBawa/Prism/main/app/public/token-meta";
const META: Record<string, { name: string; symbol: string }> = {
  sol: { name: "Test SOL", symbol: "tSOL" },
  jup: { name: "Test JUP", symbol: "tJUP" },
  bonk: { name: "Test BONK", symbol: "tBONK" },
  usdc: { name: "Test USDC", symbol: "tUSDC" },
};

const metadataPda = (mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  )[0];

async function main() {
  const conn = getConnection();
  const admin = loadKeypair(); // mint authority on the test mints
  const { mints } = loadBasketsConfig();

  for (const [key, mintStr] of Object.entries(mints)) {
    const m = META[key];
    if (!m) continue;
    const mint = pk(mintStr);
    const md = metadataPda(mint);
    const data = {
      name: m.name,
      symbol: m.symbol,
      uri: `${RAW}/${key}.json`,
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };
    const exists = await conn.getAccountInfo(md);
    const ix = exists
      ? createUpdateMetadataAccountV2Instruction(
          { metadata: md, updateAuthority: admin.publicKey },
          { updateMetadataAccountArgsV2: { data, updateAuthority: admin.publicKey, primarySaleHappened: null, isMutable: true } },
        )
      : createCreateMetadataAccountV3Instruction(
          { metadata: md, mint, mintAuthority: admin.publicKey, payer: admin.publicKey, updateAuthority: admin.publicKey },
          { createMetadataAccountArgsV3: { data, isMutable: true, collectionDetails: null } },
        );
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin], { commitment: "confirmed" });
    console.log(`  ✓ ${m.name} (${m.symbol}) ${exists ? "updated" : "created"} — ${explorer("tx", sig)}`);
  }
  console.log("\n✅ token metadata set — names show now; icons once token-meta JSONs are pushed.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
  });
