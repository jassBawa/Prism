"use client";
import type { CSSProperties } from "react";
import type { Live } from "@/lib/types";
import { assetColor } from "@/lib/constants";
import { usd } from "@/lib/format";
import { signedPct } from "@/lib/funds";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";

interface Props {
  live: Live;
  active: boolean;
  index?: number;
  chg24h?: number;
  onSelect: () => void;
}

/** One compact, scannable fund row (logo stack · name · value · 24h · weight bar). */
export function BasketRow({ live, active, index = 0, chg24h = 0, onSelect }: Props) {
  const b = live.view;
  const symbols = b.assets.map((a) => a.symbol);
  // dominant weight, for the micro-caption under the bar
  const top = b.assets
    .map((a, i) => ({ sym: a.symbol, w: (live.weightsBps[i] ?? 0) / 100 }))
    .sort((x, y) => y.w - x.w)[0];
  const caption = top
    ? `${top.sym} ${top.w.toFixed(0)}%${symbols.length > 1 ? ` · +${symbols.length - 1} more` : ""}`
    : "";

  return (
    <button
      className={"frow" + (active ? " on" : "")}
      style={{ "--i": index } as CSSProperties}
      onClick={onSelect}
      aria-pressed={active}
    >
      <div className="frow-id">
        <AssetStack symbols={symbols} size={26} />
        <div className="frow-name">
          <span className="frow-title">{b.name || symbols.join(" / ")}</span>
          <span className="frow-syms">{symbols.join(" · ")}</span>
        </div>
      </div>

      <div className="frow-val">
        <span className="frow-usd">{usd(live.navUsd, { compact: true })}</span>
        <span className={"frow-chg " + (chg24h >= 0 ? "up" : "down")}>{signedPct(chg24h)}</span>
      </div>

      <div className="frow-barwrap">
        <div className="frow-bar" aria-hidden>
          {b.assets.map((a, i) => (
            <span
              key={i}
              style={{ width: `${(live.weightsBps[i] ?? 0) / 100}%`, background: assetColor(a.symbol, i) }}
              title={`${a.symbol} ${((live.weightsBps[i] ?? 0) / 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <span className="frow-cap">{caption}</span>
      </div>

      <div className="frow-status">
        <DriftBadge live={live} />
      </div>
    </button>
  );
}
