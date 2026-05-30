import { assetColor, tokenIcon } from "@/lib/constants";

/**
 * Round token avatar. With `src` (a CoinGecko icon URL) it shows the real logo;
 * otherwise it falls back to a brand-colored gradient circle with the initial.
 */
export function TokenLogo({
  symbol,
  size = 22,
  index = 0,
  src,
}: {
  symbol: string;
  size?: number;
  index?: number;
  src?: string;
}) {
  const url = src || tokenIcon(symbol);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="coin coin-img"
        src={url}
        alt={symbol}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        title={symbol}
        loading="lazy"
      />
    );
  }

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
