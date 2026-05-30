"use client";
import type { Live } from "@/lib/types";
import type { BasketView } from "@/lib/program";
import { usd, num, pct, dateFmt } from "@/lib/format";
import { Info } from "@/components/ui/Info";
import { CopyAddr } from "@/components/ui/CopyAddr";
import { IconExternal } from "@/components/ui/icons";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";
import { AllocationRing } from "./AllocationRing";
import { BasketTable } from "./BasketTable";
import { TradePanel, type TxResult } from "./TradePanel";
import { FundOps } from "./FundOps";

interface Props {
  live: Live;
  userBalance: number;
  assetBalances: number[];
  wdAmt: string;
  setWdAmt: (v: string) => void;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDepositAssets: (uiAmounts: number[]) => void;
  onZap: (uiUsdcAmount: number) => void;
  onWithdraw: () => void;
  onRefresh: () => void;
  result: TxResult | null;
  me?: string;
  adminBusy: string | null;
  onRebalance: (b: BasketView) => void;
  onTogglePause: (b: BasketView, paused: boolean) => void;
}

export function BasketDetail({
  live,
  userBalance,
  assetBalances,
  wdAmt,
  setWdAmt,
  busy,
  connected,
  onDepositAssets,
  onZap,
  onWithdraw,
  onRefresh,
  result,
  me,
  adminBusy,
  onRebalance,
  onTogglePause,
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

          {(() => {
            const socials = [
              { label: "Website", url: b.website },
              { label: "X", url: b.twitter },
              { label: "Telegram", url: b.telegram },
              { label: "Discord", url: b.discord },
            ].filter((s) => s.url && s.url.trim().length > 0);
            if (!socials.length) return null;
            return (
              <div className="fund-socials">
                {socials.map((s) => (
                  <a key={s.label} className="social-chip" href={s.url} target="_blank" rel="noreferrer">
                    {s.label} <IconExternal width={12} height={12} />
                  </a>
                ))}
              </div>
            );
          })()}

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
            Pyth ≤60s · ≤2% <Info k="pyth" align="right" />
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
            wdAmt={wdAmt}
            setWdAmt={setWdAmt}
            userBalance={userBalance}
            assetBalances={assetBalances}
            busy={busy}
            connected={connected}
            onDepositAssets={onDepositAssets}
            onZap={onZap}
            onWithdraw={onWithdraw}
            onRefresh={onRefresh}
            result={result}
          />
          <FundOps
            live={live}
            me={me}
            adminBusy={adminBusy}
            onRebalance={onRebalance}
            onTogglePause={onTogglePause}
          />
        </aside>
      </div>
  );
}
