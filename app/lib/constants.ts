import { PublicKey } from "@solana/web3.js";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";
export const PROGRAM_ID = new PublicKey("8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe");

// Baked basket config (override per-deploy via NEXT_PUBLIC_BASKET_* env if needed).
export const BASKET = {
  basket: process.env.NEXT_PUBLIC_BASKET || "Fto46ZKQVFRopvJXENhmnBYNiPA1SW6Sb5jY3VC8tmNy",
  basketMint: process.env.NEXT_PUBLIC_BASKET_MINT || "5nXvhojyAAR4QYJpDUPggX4J1x4HzDGNu9yUsLpUy7Ea",
  mints: {
    sol: process.env.NEXT_PUBLIC_MINT_SOL || "7J9P83RFwfB5ocVsNwH3BAcpCAjFud98xJW2YvFRn7Yg",
    jup: process.env.NEXT_PUBLIC_MINT_JUP || "2aoy4uRESzV7kFS9iFV1cTWCNWqLX2giUfVTrkRs157a",
    usdc: process.env.NEXT_PUBLIC_MINT_USDC || "BFkaUcq6zyYnR1V5riFkPUDbCm4XxbeepPXX9RnSsbou",
  },
  vaults: {
    sol: process.env.NEXT_PUBLIC_VAULT_SOL || "8RoQHnCkSFBcat5pjE8SSi4LXKxirV7rq1qCGgaFD6P",
    jup: process.env.NEXT_PUBLIC_VAULT_JUP || "26eku5ioWK3Rr9amBJkmCx6FcVEkEtw4oqCBGzQ2ES3e",
    usdc: process.env.NEXT_PUBLIC_VAULT_USDC || "BKnzCBXkMPVXMKv7a5amPPXHy6LCXsDe8fY2UCLEAL9k",
  },
};

export const FEED_HEX = {
  sol: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  jup: "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  usdc: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
} as const;
export type AssetKey = keyof typeof FEED_HEX;
export const feedId0x = (k: AssetKey): string => "0x" + FEED_HEX[k];

export interface AssetMeta {
  key: AssetKey;
  symbol: string;
  decimals: number;
  weightBps: number;
  mint: string;
  vault: string;
}
export const ASSETS: AssetMeta[] = [
  { key: "sol", symbol: "SOL", decimals: 9, weightBps: 5000, mint: BASKET.mints.sol, vault: BASKET.vaults.sol },
  { key: "jup", symbol: "JUP", decimals: 6, weightBps: 3000, mint: BASKET.mints.jup, vault: BASKET.vaults.jup },
  { key: "usdc", symbol: "USDC", decimals: 6, weightBps: 2000, mint: BASKET.mints.usdc, vault: BASKET.vaults.usdc },
];
export const USDC_INDEX = 2;
