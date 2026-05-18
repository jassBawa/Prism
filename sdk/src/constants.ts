import { createRequire } from "node:module";
import { PublicKey } from "@solana/web3.js";

const require = createRequire(import.meta.url);
// The on-chain IDL (has `.address` baked in). Source of truth for the program id.
export const idl = require("./idl.json");

export const PROGRAM_ID = new PublicKey(idl.address);
export const RPC_URL = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";

// PDA seeds — must match the program.
export const BASKET_SEED = Buffer.from("basket");
export const MINT_SEED = Buffer.from("mint");
export const ASSET_SEED = Buffer.from("asset");

export const PYTH_RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

// ---------------------------------------------------------------------------
// Curated supported-asset registry — the ONE place feed ids + decimals live.
// A basket may only be composed from these (mirrors the on-chain allowlist).
// `decimals` MUST match the asset the Pyth feed prices, or NAV is off by 10^x.
// `quoteEligible` = may be a basket's deposit/quote asset (stables only).
// ---------------------------------------------------------------------------
export interface SupportedAsset {
  key: string;
  symbol: string;
  feedHex: string; // Pyth feed id, hex, no 0x
  decimals: number;
  quoteEligible: boolean;
}

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  { key: "sol", symbol: "SOL", feedHex: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", decimals: 9, quoteEligible: false },
  { key: "jup", symbol: "JUP", feedHex: "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996", decimals: 6, quoteEligible: false },
  { key: "bonk", symbol: "BONK", feedHex: "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419", decimals: 5, quoteEligible: false },
  { key: "usdc", symbol: "USDC", feedHex: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", decimals: 6, quoteEligible: true },
];

export const supportedByKey = (k: string): SupportedAsset => {
  const a = SUPPORTED_ASSETS.find((x) => x.key === k);
  if (!a) throw new Error(`unsupported asset: ${k}`);
  return a;
};
export const supportedByFeed = (feedHex: string): SupportedAsset | undefined =>
  SUPPORTED_ASSETS.find((x) => x.feedHex === feedHex);

export const feedId0x = (feedHex: string): string => "0x" + feedHex;
export const feedBytes = (feedHex: string): number[] => Array.from(Buffer.from(feedHex, "hex"));

// On-chain caps (match the program).
export const MIN_ASSETS = 2;
export const PRICED_MAX_ASSETS = 4;

// Demo defaults.
export const REBALANCE_THRESHOLD_BPS = 100; // 1% drift
export const REBALANCE_INTERVAL_SECS = 30;

export const explorer = (kind: "address" | "tx", id: string): string =>
  `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
