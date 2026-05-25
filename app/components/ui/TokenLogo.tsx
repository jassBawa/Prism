import { assetColor } from "@/lib/constants";

/**
 * Consistent round coin avatar — a brand-colored gradient circle with the
 * token's initial. Uniform across every token (no mismatched logo art).
 */
export function TokenLogo({ symbol, size = 22, index = 0 }: { symbol: string; size?: number; index?: number }) {
  const c = assetColor(symbol, index);
  return (
    <span
      className="coin"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `radial-gradient(120% 120% at 30% 22%, ${c}, color-mix(in srgb, ${c} 62%, #05070e))`,
      }}
      title={symbol}
    >
      {symbol.slice(0, 1)}
    </span>
  );
}
