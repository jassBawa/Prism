"use client";
import type { Live } from "@/lib/types";
import { usd, num, pct, shortAddr } from "@/lib/format";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";
import { AllocationRing } from "./AllocationRing";
import { AllocationRows } from "./AllocationRows";
import { TradePanel } from "./TradePanel";

interface Props {
  live: Live;
  quoteSym: string;
  userBalance: number;
  depAmt: string;
  wdAmt: string;
  setDepAmt: (v: string) => void;
  setWdAmt: (v: string) => void;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function BasketDetail({
  live,
  quoteSym,
  userBalance,
  depAmt,
  wdAmt,
  setDepAmt,
  setWdAmt,
  busy,
  connected,
  onDeposit,
  onWithdraw,
}: Props) {
  const b = live.view;
  const symbols = b.assets.map((a) => a.symbol);
  const unitPrice = live.supply > 0 ? live.navUsd / live.supply : 1;

  return (
    <div className="card">
      <div className="detail-head">
        <h2>
          <AssetStack symbols={symbols} />
          {symbols.join(" / ")}
          <span className="idtag">#{b.id}</span>
        </h2>
        <DriftBadge live={live} />
      </div>

      <div className="detail">
        <AllocationRing live={live} />
        <div>
          <AllocationRows live={live} />
          <div className="meta-strip">
            <span className="m">
              <span className="k">Unit price</span>
              <span className="v">{usd(unitPrice)}</span>
            </span>
            <span className="m">
              <span className="k">Supply</span>
              <span className="v">{num(live.supply)}</span>
            </span>
            <span className="m">
              <span className="k">Drift threshold</span>
              <span className="v">{pct(b.thresholdBps)}</span>
            </span>
            <span className="m">
              <span className="k">Rebalance every</span>
              <span className="v">{b.intervalSecs}s</span>
            </span>
            <span className="m">
              <span className="k">Mint</span>
              <span className="v">{shortAddr(b.basketMint.toBase58())}</span>
            </span>
          </div>
        </div>
      </div>

      <TradePanel
        quoteSym={quoteSym}
        depAmt={depAmt}
        wdAmt={wdAmt}
        setDepAmt={setDepAmt}
        setWdAmt={setWdAmt}
        userBalance={userBalance}
        busy={busy}
        connected={connected}
        onDeposit={onDeposit}
        onWithdraw={onWithdraw}
      />
    </div>
  );
}
