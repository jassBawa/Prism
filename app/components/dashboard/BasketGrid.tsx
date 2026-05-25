"use client";
import type { Live } from "@/lib/types";
import { useMarketPrices } from "@/lib/prices";
import { chgMap, fundChange24h } from "@/lib/funds";
import { PrismArt } from "@/components/ui/PrismArt";
import { BasketRow } from "./BasketRow";

interface Props {
  lives: Live[];
  selected: string | null;
  loading: boolean;
  onSelect: (pk: string) => void;
}

/** Compact, scannable list of fund rows. */
export function BasketGrid({ lives, selected, loading, onSelect }: Props) {
  const prices = useMarketPrices();
  const chg = chgMap(prices);

  if (loading && lives.length === 0) {
    return (
      <div className="flist">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel frow-skel" />
        ))}
      </div>
    );
  }

  if (lives.length === 0) {
    return (
      <div className="empty">
        <PrismArt size={120} />
        <div className="et">No funds on-chain yet</div>
        <div className="es">
          Be the first. Pick your assets, set the target weights, and ship a self-rebalancing index in a couple
          of clicks.
        </div>
      </div>
    );
  }

  return (
    <div className="flist">
      {lives.map((l, i) => {
        const pk = l.view.pubkey.toBase58();
        return (
          <BasketRow
            key={pk}
            live={l}
            index={i}
            chg24h={fundChange24h(l, chg)}
            active={selected === pk}
            onSelect={() => onSelect(pk)}
          />
        );
      })}
    </div>
  );
}
