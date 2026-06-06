"use client";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import type { Live } from "@/lib/types";
import type { BasketView } from "@/lib/program";
import { usd, num, pct, dateFmt } from "@/lib/format";
import { Info } from "@/components/ui/Info";

/** Holder count from the basket mint's largest token accounts (capped at 20 by RPC → "20+"). */
function useHolderCount(mint: PublicKey): number | null {
  const { connection } = useConnection();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    connection
      .getTokenLargestAccounts(mint)
      .then((r) => alive && setN(r.value.filter((a) => (a.uiAmount ?? 0) > 0).length))
      .catch(() => alive && setN(null));
    return () => {
      alive = false;
    };
  }, [connection, mint]);
  return n;
}
import { CopyAddr } from "@/components/ui/CopyAddr";
import { IconExternal } from "@/components/ui/icons";
import { AssetStack } from "./AssetDot";
import { DriftBadge } from "./DriftBadge";
import { AllocationRing } from "./AllocationRing";
import { BasketTable } from "./BasketTable";
import { TradePanel, type TxResult } from "./TradePanel";
import { FundOps } from "./FundOps";
import { NavChart } from "./NavChart";
import { fetchNavHistory, type NavPoint } from "@/lib/history";

/** "12m" / "5h" / "2d" span label for the history window. */
function spanLabel(ms: number): string {
  if (ms < 3.6e6) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (ms < 8.64e7) return `${Math.round(ms / 3.6e6)}h`;
  return `${Math.round(ms / 8.64e7)}d`;
}

interface Props {
  live: Live;
  userBalance: number;
  assetBalances: number[];
  wdAmt: string;
  setWdAmt: (v: string) => void;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDepositAssets: (uiAmounts: number[]) => void;
  onDeposit: (uiUsdcAmount: number) => void;
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
  onDeposit,
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
  const holders = useHolderCount(b.basketMint);

  const [hist, setHist] = useState<NavPoint[]>([]);
  useEffect(() => {
    let alive = true;
    const key = b.pubkey.toBase58();
    const load = () => fetchNavHistory(key).then((p) => alive && setHist(p)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [b.pubkey]);
  const perfPct = hist.length >= 2 ? ((hist[hist.length - 1]!.nav - hist[0]!.nav) / hist[0]!.nav) * 100 : null;
  const histWindow = hist.length >= 2 ? spanLabel(hist[hist.length - 1]!.t - hist[0]!.t) : "";

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
            <div className="dstat">
              <div className="dlabel">Holders</div>
              <div className="dval">{holders === null ? "…" : holders >= 20 ? "20+" : holders}</div>
            </div>
          </div>
        </div>

        <div className="perf-card">
          <div className="perf-head">
            <span className="perf-title">
              Performance
              <span className="perf-sub">NAV{histWindow ? ` · last ${histWindow}` : ""}</span>
            </span>
            <span className="perf-now">
              {usd(live.navUsd)}
              {perfPct !== null && (
                <span className={"perf-delta " + (perfPct >= 0 ? "up" : "down")}>
                  {perfPct >= 0 ? "▲" : "▼"} {Math.abs(perfPct).toFixed(2)}%
                </span>
              )}
            </span>
          </div>
          <NavChart points={hist} />
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
            onDeposit={onDeposit}
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
