// Shared (server + client) market-price types and the fixed token list.
// No "use client" — safe to import from the API route handler.

export interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
  /** CoinGecko icon URL (empty if unavailable → falls back to a letter badge). */
  image: string;
}

// CoinGecko id → ticker symbol.
export const MARKET_COINS: { id: string; symbol: string }[] = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
  { id: "jupiter-exchange-solana", symbol: "JUP" },
  { id: "bonk", symbol: "BONK" },
  { id: "usd-coin", symbol: "USDC" },
  { id: "binancecoin", symbol: "BNB" },
  { id: "ripple", symbol: "XRP" },
  { id: "dogecoin", symbol: "DOGE" },
  { id: "cardano", symbol: "ADA" },
];
