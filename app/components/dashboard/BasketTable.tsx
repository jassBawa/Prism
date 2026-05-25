"use client";
import type { Live } from "@/lib/types";
import { usd, num, shortAddr } from "@/lib/format";
import { TokenLogo } from "@/components/ui/TokenLogo";

/** Per-asset holdings table: Token · Current/Target weight · Amount/Value. */
export function BasketTable({ live }: { live: Live }) {
  const b = live.view;
  return (
    <div className="btable">
      <div className="btable-head">
        <span>Token</span>
        <span className="r">Current / Target</span>
        <span className="r">Amount / Value</span>
      </div>
      {b.assets.map((a, i) => {
        const cur = (live.weightsBps[i] ?? 0) / 100;
        const tgt = a.targetWeightBps / 100;
        const off = cur - tgt;
        return (
          <div className="btable-row" key={a.mint.toBase58()}>
            <div className="bt-token">
              <TokenLogo symbol={a.symbol} index={i} size={28} />
              <div className="bt-id">
                <div className="bt-sym">{a.symbol}</div>
                <div className="bt-mint">{shortAddr(a.mint.toBase58())}</div>
              </div>
            </div>
            <div className="bt-col r">
              <div className="bt-cur">
                {cur.toFixed(2)}%
                <span className={"bt-off " + (off > 0 ? "over" : off < 0 ? "under" : "")}>
                  {off === 0 ? "" : `${off > 0 ? "+" : ""}${off.toFixed(1)}`}
                </span>
              </div>
              <div className="bt-sub">target {tgt.toFixed(0)}%</div>
            </div>
            <div className="bt-col r">
              <div className="bt-amt">{num(live.amounts[i] ?? 0, 4)}</div>
              <div className="bt-sub">{usd(live.valuesUsd[i] ?? 0)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
