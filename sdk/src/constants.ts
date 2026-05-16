import { createRequire } from "node:module";
import { PublicKey } from "@solana/web3.js";

const require = createRequire(import.meta.url);
// The on-chain IDL (has `.address` baked in). Source of truth for the program id.
export const idl = require("./idl.json");

export const PROGRAM_ID = new PublicKey(idl.address);
export const RPC_URL = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
export const BASKET_SEED = Buffer.from("basket");
export const PYTH_RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

// Pyth feed ids (hex, no 0x) — the ONE place these live. SOL/USD, JUP/USD, USDC/USD.
export const FEED_HEX = {
  sol: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  jup: "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  usdc: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
} as const;
export type AssetKey = keyof typeof FEED_HEX;
export const feedId0x = (k: AssetKey): string => "0x" + FEED_HEX[k];
export const feedBytes = (k: AssetKey): number[] => Array.from(Buffer.from(FEED_HEX[k], "hex"));

// Asset slots — order MUST match the program (0=SOL, 1=JUP, 2=USDC). Decimals
// MUST match the real assets the Pyth feeds price (9/6/6), else NAV is off by 10^x.
export const ASSETS: { key: AssetKey; decimals: number; weightBps: number }[] = [
  { key: "sol", decimals: 9, weightBps: 5000 },
  { key: "jup", decimals: 6, weightBps: 3000 },
  { key: "usdc", decimals: 6, weightBps: 2000 },
];
export const USDC_INDEX = 2;
export const REBALANCE_THRESHOLD_BPS = 100; // 1% drift
export const REBALANCE_INTERVAL_SECS = 30;

export const explorer = (kind: "address" | "tx", id: string): string =>
  `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
