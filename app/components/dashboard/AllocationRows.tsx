"use client";
import type { Live } from "@/lib/types";
import { assetColor } from "@/lib/constants";

/** Per-asset bars: current fill + target marker line. */
export function AllocationRows({ live }: { live: Live }) {
  const b = live.view;
  return (
    <div className="alloc">
      {b.assets.map((a, i) => {
        const cur = (live.weightsBps[i] ?? 0) / 100;
        const tgt = a.targetWeightBps / 100;
        return (
          <div className="alloc-row" key={a.mint.toBase58()}>
            <div className="tag" style={{ color: assetColor(a.symbol, i) }}>
              {a.symbol}
            </div>
            <div className="bar" title={`current ${cur.toFixed(1)}% · target ${tgt}%`}>
              <span style={{ width: `${Math.min(100, cur)}%`, background: assetColor(a.symbol, i) }} />
              <i style={{ left: `${Math.min(100, tgt)}%` }} title={`target ${tgt}%`} />
            </div>
            <div className="alloc-val">
              {cur.toFixed(1)}% <span className="tgt">/ {tgt}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
