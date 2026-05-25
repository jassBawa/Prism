"use client";
import type { Live } from "@/lib/types";
import { usd, num, pct, dateFmt } from "@/lib/format";
import { Info } from "@/components/ui/Info";
import { CopyAddr } from "@/components/ui/CopyAddr";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";
import { AllocationRing } from "./AllocationRing";
import { BasketTable } from "./BasketTable";
import { TradePanel, type TxResult } from "./TradePanel";

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
  result: TxResult | null;
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
  result,
}: Props) {
  const b = live.view;
  const symbols = b.assets.map((a) => a.symbol);
  const unitPrice = live.supply > 0 ? live.navUsd / live.supply : 1;

  return (
    <div className="modal-2col">
      <div className="modal-main">
        <div className="fund-head">
          <div className="fund-title">
            <AssetStack symbols={symbols} size={28} />
            <div className="fund-titletext">
              <h2>
                {b.name || symbols.join(" / ")}
                <span className="idtag">#{b.id}</span>
              </h2>
              <div className="fund-assetline">{symbols.join(" · ")}</div>
            </div>
            <span className="drift-wrap">
              <DriftBadge live={live} />
              <Info k="drift" align="right" />
            </span>
          </div>

          {b.description && <p className="fund-desc">{b.description}</p>}

          <div className="fund-meta">
            <span className="fm">
              <span className="fmk">Created by</span>
              <CopyAddr addr={b.authority.toBase58()} />
            </span>
            <span className="fm">
              <span className="fmk">Portfolio</span>
              <CopyAddr addr={b.pubkey.toBase58()} link />
            </span>
            <span className="fm">
              <span className="fmk">Created</span>
              {dateFmt(b.createdTs)}
            </span>
            <span className="fm">
              <span className="fmk">Creator fee</span>
              {pct(b.feeBps)}
            </span>
          </div>
        </div>

        <div className="detail-chips">
          <span className="dchip">
            <span className="dk">Creator fee</span>
            {pct(b.feeBps)} <Info k="fee" />
          </span>
          <span className="dchip">
            <span className="dk">Drift gate</span>
            {pct(b.thresholdBps)} / {pct(b.thresholdRelBps)} <Info k="driftAbs" />
          </span>
          <span className="dchip">
            <span className="dk">Spread</span>
            {pct(b.spreadBps)} <Info k="spread" />
          </span>
          <span className="dchip">
            <span className="dk">Auto</span>
            every {b.intervalSecs}s <Info k="interval" />
          </span>
          <span className="dchip">
            <span className="dk">Guards</span>
            Pyth ≤60s · ≤2% <Info k="pyth" />
          </span>
        </div>

        <div className="detail-top">
          <AllocationRing live={live} />
          <div className="detail-stats">
            <div className="dstat">
              <div className="dlabel">
                Total value locked <Info k="nav" />
              </div>
              <div className="dval">{usd(live.navUsd)}</div>
            </div>
            <div className="dstat">
              <div className="dlabel">
                Circulating supply <Info k="supply" />
              </div>
              <div className="dval">{num(live.supply)}</div>
            </div>
            <div className="dstat">
              <div className="dlabel">
                Unit price <Info k="unitPrice" />
              </div>
              <div className="dval">{usd(unitPrice)}</div>
            </div>
          </div>
        </div>

        <BasketTable live={live} />
      </div>

        <aside className="modal-side">
          <TradePanel
            live={live}
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
            result={result}
          />
        </aside>
      </div>
  );
}
