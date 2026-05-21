import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { configExists, loadBasketsConfig } from "../sdk/src/config.js";

// Point the dashboard at a CUSTOM deployment by writing app/.env.local.
// Only needed for your own seed, a local validator, or a private RPC — the app
// already ships with live-devnet defaults baked into app/lib/constants.ts, so a
// plain `pnpm dev` needs none of this.
//
// Falls back to the public devnet deployment (program id + test mints) when
// .keys/basket.json is absent (fresh clone), so it never hard-fails.
const PUBLIC_DEVNET = {
  programId: "8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe",
  mints: {
    sol: "BPgaZJyFNVpcYcKQLiUL5u28rFhFKidKU1h3MhNkfKWE",
    jup: "2uBkvi6E332exDsk8mw3ToDbjEsepuEmnCJeS4HGmTP4",
    bonk: "6BVicGVPCN6F6a8buVqH9b3TxpsNVqjEhz4BzEBmHCm5",
    usdc: "DhuAw2uxXP5r9ufdsPs25Kk98ippMSss2brrxzBsQy5E",
  } as Record<string, string>,
};

const cfg = configExists() ? loadBasketsConfig() : PUBLIC_DEVNET;
const rpc = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
const faucet = process.env.FAUCET_URL?.trim() || "";
const env =
  [
    `NEXT_PUBLIC_RPC_URL=${rpc}`,
    `NEXT_PUBLIC_PROGRAM_ID=${cfg.programId}`,
    `NEXT_PUBLIC_MINTS=${JSON.stringify(cfg.mints)}`,
    `NEXT_PUBLIC_FAUCET_URL=${faucet}`,
  ].join("\n") + "\n";

writeFileSync(resolve(process.cwd(), "app/.env.local"), env);
console.log(`wrote app/.env.local → RPC ${rpc}${configExists() ? " (from .keys/basket.json)" : " (public devnet defaults)"}`);
