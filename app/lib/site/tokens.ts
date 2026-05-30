// Lean, dependency-free token metadata for the marketing site. Kept separate
// from lib/constants (which imports @solana/web3.js) so the site bundle stays small.

export const TOKEN_ICON: Record<string, string> = {
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  JUP: "https://assets.coingecko.com/coins/images/34188/large/jup.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  BONK: "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
};

// Tokenized equities ("xStocks") that settle on Solana — the roadmap teaser.
export const XSTOCKS = [
  "AAPLx",
  "TSLAx",
  "NVDAx",
  "MSFTx",
  "GOOGLx",
  "AMZNx",
  "METAx",
  "SPYx",
  "COINx",
  "MSTRx",
] as const;
