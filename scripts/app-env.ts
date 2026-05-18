import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadBasketsConfig } from "../sdk/src/config.js";

// Sync the dashboard to the current deployment: writes app/.env.local.
// The dashboard discovers baskets dynamically (getProgramAccounts), so it only
// needs the program id, RPC, and the controlled test-mint addresses (for the
// create-basket form to map a supported-asset key -> its on-chain mint).
const cfg = loadBasketsConfig();
const rpc = process.env.RPC_URL || "http://127.0.0.1:8899";
const env =
  [
    `NEXT_PUBLIC_RPC_URL=${rpc}`,
    `NEXT_PUBLIC_PROGRAM_ID=${cfg.programId}`,
    `NEXT_PUBLIC_MINTS=${JSON.stringify(cfg.mints)}`,
  ].join("\n") + "\n";

writeFileSync(resolve(process.cwd(), "app/.env.local"), env);
console.log("wrote app/.env.local (RPC + program id + test mints) from .keys/basket.json");
