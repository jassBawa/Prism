"use client";
import type { Live } from "@/lib/types";
import { assetColor } from "@/lib/constants";
import { usd } from "@/lib/format";

/** Donut chart of current allocation (conic-gradient) + legend. */
export function AllocationRing({ live }: { live: Live }) {
  const b = live.view;
  let acc = 0;
  const stops: string[] = [];
  b.assets.forEach((a, i) => {
    const w = (live.weightsBps[i] ?? 0) / 100;
    const color = assetColor(a.symbol, i);
    stops.push(`${color} ${acc}% ${acc + w}%`);
    acc += w;
  });
  if (acc < 100) stops.push(`#1a2030 ${acc}% 100%`);
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="ring-wrap">
      <div className="ring" style={{ background: gradient }} role="img" aria-label="allocation breakdown">
        <div className="ring-center">
          <div className="k">NAV</div>
          <div className="v">{usd(live.navUsd, { compact: true })}</div>
        </div>
      </div>
      <div className="legend">
        {b.assets.map((a, i) => (
          <div className="legend-row" key={a.mint.toBase58()}>
            <span className="swatch" style={{ background: assetColor(a.symbol, i) }} />
            <span className="lname">{a.symbol}</span>
            <span className="lval">{((live.weightsBps[i] ?? 0) / 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
