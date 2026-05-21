import { assetColor } from "@/lib/constants";

/** Overlapping circle stack of asset symbols, used in basket cards/headers. */
export function AssetStack({ symbols }: { symbols: string[] }) {
  return (
    <span className="sym-stack" aria-hidden>
      {symbols.map((s, i) => (
        <span key={i} className="sym-dot" style={{ background: assetColor(s, i) }} title={s}>
          {s.slice(0, 1)}
        </span>
      ))}
    </span>
  );
}
