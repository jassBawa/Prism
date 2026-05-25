"use client";
import { useState } from "react";
import type { Live } from "@/lib/types";
import { num, pct, usd, shortAddr, explorerTx } from "@/lib/format";
import { Info } from "@/components/ui/Info";
import { IconCopy, IconCheck, IconExternal } from "@/components/ui/icons";

export interface TxResult {
  action: "deposit" | "withdraw";
  sig: string;
}

interface Props {
  live: Live;
  quoteSym: string;
  depAmt: string;
  wdAmt: string;
  setDepAmt: (v: string) => void;
  setWdAmt: (v: string) => void;
  userBalance: number;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  result: TxResult | null;
}

function ResultRow({ sig }: { sig: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="tx-result">
      <a className="tx-link" href={explorerTx(sig)} target="_blank" rel="noreferrer">
        <IconExternal width={13} height={13} /> {shortAddr(sig, 6)}
      </a>
      <button
        className="tx-copy"
        type="button"
        aria-label="Copy signature"
        onClick={() => {
          void navigator.clipboard?.writeText(sig);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
      </button>
    </div>
  );
}

export function TradePanel({
  live,
  quoteSym,
  depAmt,
  wdAmt,
  setDepAmt,
  setWdAmt,
  userBalance,
  busy,
  connected,
  onDeposit,
  onWithdraw,
  result,
}: Props) {
  const b = live.view;
  const unitPrice = live.supply > 0 ? live.navUsd / live.supply : 1;

  // Deposit preview: shares = quote / unitPrice, minus the creator fee.
  const dep = Number(depAmt) || 0;
  const grossShares = dep > 0 ? dep / unitPrice : 0;
  const feeShares = grossShares * (b.feeBps / 10000);
  const netShares = grossShares - feeShares;

  // Withdraw preview: in-kind, pro-rata per asset by current weight.
  const wd = Number(wdAmt) || 0;
  const wdUsd = wd * unitPrice;
  const perAsset = b.assets.map((a, i) => ({
    symbol: a.symbol,
    usd: wdUsd * ((live.weightsBps[i] ?? 0) / 10000),
  }));

  return (
    <div className="trade">
      <div className="trade-card">
        <div className="th">
          <span className="t">
            Deposit {quoteSym} <Info k="basketToken" />
          </span>
          <span className="bal">get fund tokens at the live price</span>
        </div>
        <div className="field">
          <input value={depAmt} onChange={(e) => setDepAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
          <span className="unit">{quoteSym}</span>
        </div>

        {dep > 0 && (
          <div className="preview">
            <div className="prow">
              <span>You receive</span>
              <span className="pv">≈ {num(netShares)} tokens</span>
            </div>
            <div className="prow muted">
              <span>
                Unit price <Info k="unitPrice" />
              </span>
              <span>{usd(unitPrice)}</span>
            </div>
            <div className="prow muted">
              <span>
                Creator fee <Info k="fee" />
              </span>
              <span>
                {pct(b.feeBps)} ({num(feeShares)})
              </span>
            </div>
          </div>
        )}

        <button className="act" disabled={!connected || busy !== null} onClick={onDeposit}>
          {busy === "deposit" ? (
            <>
              <span className="spinner" /> Posting Pyth price → minting…
            </>
          ) : connected ? (
            "Deposit"
          ) : (
            "Connect wallet"
          )}
        </button>
        {result?.action === "deposit" && <ResultRow sig={result.sig} />}
      </div>

      <div className="trade-card">
        <div className="th">
          <span className="t">
            Withdraw <Info k="inKind" />
          </span>
          <span className="bal">balance {num(userBalance)}</span>
        </div>
        <div className="field">
          <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
          {connected && userBalance > 0 ? (
            <button className="maxbtn" onClick={() => setWdAmt(String(userBalance))} type="button">
              MAX
            </button>
          ) : (
            <span className="unit">tokens</span>
          )}
        </div>

        {wd > 0 && (
          <div className="preview">
            <div className="prow">
              <span>You receive (your share of each asset)</span>
              <span className="pv">≈ {usd(wdUsd)}</span>
            </div>
            <div className="prow muted inkind">
              {perAsset.map((p) => (
                <span key={p.symbol}>
                  {usd(p.usd)} {p.symbol}
                </span>
              ))}
            </div>
          </div>
        )}

        <button className="act" disabled={!connected || busy !== null} onClick={onWithdraw}>
          {busy === "withdraw" ? (
            <>
              <span className="spinner" /> Withdrawing…
            </>
          ) : connected ? (
            "Withdraw"
          ) : (
            "Connect wallet"
          )}
        </button>
        {result?.action === "withdraw" && <ResultRow sig={result.sig} />}
      </div>
    </div>
  );
}
