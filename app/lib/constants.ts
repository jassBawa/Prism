import { PublicKey } from "@solana/web3.js";

// Defaults target the live public devnet deployment, so the app runs with zero
// config (`pnpm dev`). Override any of these via NEXT_PUBLIC_* env / app/.env.local.
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe");
// The ops faucet base URL (empty = hide the "Get test funds" button, e.g. local dev).
export const FAUCET_URL = process.env.NEXT_PUBLIC_FAUCET_URL || "";

export const MIN_ASSETS = 2;
export const PRICED_MAX_ASSETS = 4;

export interface SupportedAsset {
  key: string;
  symbol: string;
  feedHex: string;
  decimals: number;
  quoteEligible: boolean;
  mint?: string; // on this deployment (from NEXT_PUBLIC_MINTS), needed only to create baskets
}

const REGISTRY: Omit<SupportedAsset, "mint">[] = [
  { key: "sol", symbol: "SOL", feedHex: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", decimals: 9, quoteEligible: false },
  { key: "jup", symbol: "JUP", feedHex: "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996", decimals: 6, quoteEligible: false },
  { key: "bonk", symbol: "BONK", feedHex: "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419", decimals: 5, quoteEligible: false },
  { key: "usdc", symbol: "USDC", feedHex: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", decimals: 6, quoteEligible: true },
];

// The live devnet deployment's test mints — baked so the app works with no env.
// Play-money tokens (admin holds mint authority); override via NEXT_PUBLIC_MINTS.
const DEFAULT_MINTS: Record<string, string> = {
  sol: "BPgaZJyFNVpcYcKQLiUL5u28rFhFKidKU1h3MhNkfKWE",
  jup: "2uBkvi6E332exDsk8mw3ToDbjEsepuEmnCJeS4HGmTP4",
  bonk: "6BVicGVPCN6F6a8buVqH9b3TxpsNVqjEhz4BzEBmHCm5",
  usdc: "DhuAw2uxXP5r9ufdsPs25Kk98ippMSss2brrxzBsQy5E",
};

const MINTS: Record<string, string> = (() => {
  const raw = process.env.NEXT_PUBLIC_MINTS;
  if (!raw) return DEFAULT_MINTS;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.keys(parsed).length ? parsed : DEFAULT_MINTS;
  } catch {
    return DEFAULT_MINTS;
  }
})();

export const SUPPORTED_ASSETS: SupportedAsset[] = REGISTRY.map((a) => ({ ...a, mint: MINTS[a.key] }));

export const supportedByFeedHex = (hex: string): SupportedAsset | undefined =>
  SUPPORTED_ASSETS.find((a) => a.feedHex === hex);

export const feedId0x = (hex: string): string => "0x" + hex;

export const COLORS: Record<string, string> = {
  SOL: "var(--sol)",
  JUP: "var(--jup)",
  BONK: "#f5a623",
  USDC: "var(--usdc)",
};

const FALLBACK_PALETTE = ["#6e8bff", "#a78bfa", "#34d399", "#f5a623", "#f472b6", "#22d3ee"];

/** Stable color for any asset symbol (known assets keep their brand color). */
export function assetColor(symbol: string, index = 0): string {
  return COLORS[symbol] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]!;
}
