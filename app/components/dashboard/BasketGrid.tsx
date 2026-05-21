"use client";
import type { Live } from "@/lib/types";
import { BasketCard } from "./BasketCard";

interface Props {
  lives: Live[];
  selected: string | null;
  loading: boolean;
  onSelect: (pk: string) => void;
}

export function BasketGrid({ lives, selected, loading, onSelect }: Props) {
  if (loading && lives.length === 0) {
    return (
      <div className="bgrid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel bcard-skel" />
        ))}
      </div>
    );
  }

  if (lives.length === 0) {
    return (
      <div className="empty">
        <div className="emoji">🧺</div>
        <div className="et">No baskets yet</div>
        <div className="es">Create your first index basket below — pick assets, set weights, and go.</div>
      </div>
    );
  }

  return (
    <div className="bgrid">
      {lives.map((l) => {
        const pk = l.view.pubkey.toBase58();
        return <BasketCard key={pk} live={l} active={selected === pk} onSelect={() => onSelect(pk)} />;
      })}
    </div>
  );
}
