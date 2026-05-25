import { TokenLogo } from "@/components/ui/TokenLogo";

/** Overlapping stack of token logos, used in basket cards/headers. */
export function AssetStack({ symbols, size = 22 }: { symbols: string[]; size?: number }) {
  return (
    <span className="sym-stack" aria-hidden>
      {symbols.map((s, i) => (
        <TokenLogo key={i} symbol={s} index={i} size={size} />
      ))}
    </span>
  );
}
