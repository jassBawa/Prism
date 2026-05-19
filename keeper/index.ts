import { startKeeper } from "./loop.js";

// CLI: `pnpm run keeper` (loop) or `pnpm run keeper -- --once`.
startKeeper({ once: process.argv.includes("--once") }).catch((e) => {
  console.error(e);
  process.exit(1);
});
