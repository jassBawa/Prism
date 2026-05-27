"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Live } from "@/lib/types";
import { num, usd, shortAddr, explorerTx } from "@/lib/format";
import { assetColor } from "@/lib/constants";
import { Info } from "@/components/ui/Info";
import { Modal } from "@/components/ui/Modal";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { IconCopy, IconCheck, IconExternal, IconRefresh, IconArrowDown, IconPlus } from "@/components/ui/icons";

export interface TxResult {
  action: "deposit" | "withdraw";
  sig: string;
}

interface Props {
  live: Live;
  assetBalances: number[];
  userBalance: number;
  wdAmt: string;
  setWdAmt: (v: string) => void;
  busy: "deposit" | "withdraw" | null;
  connected: boolean;
  onDepositAssets: (uiAmounts: number[]) => void;
  onZap: (uiUsdcAmount: number) => void;
  onWithdraw: () => void;
  onRefresh: () => void;
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
  assetBalances,
  userBalance,
  wdAmt,
  setWdAmt,
  busy,
  connected,
  onDepositAssets,
  onZap,
  onWithdraw,
  onRefresh,
  result,
}: Props) {
  const b = live.view;
  const assets = b.assets;
  const pk = b.pubkey.toBase58();
  const qi = b.quoteIndex;
  const quoteSym = assets[qi]?.symbol ?? "USDC";
  const unitPrice = live.supply > 0 ? live.navUsd / live.supply : 1;
  const positionUsd = userBalance * unitPrice;

  const [openDep, setOpenDep] = useState(false);
  const [openWd, setOpenWd] = useState(false);
  const [mode, setMode] = useState<"zap" | "manual">("zap");
  const [zapAmt, setZapAmt] = useState("");
  const quoteBal = assetBalances[qi] ?? 0;
  const zapNum = Number(zapAmt) || 0;
  const zapOver = connected && zapNum > quoteBal + 1e-9;

  // per-asset deposit amounts (strings), reset when the fund / modal changes
  const [amts, setAmts] = useState<string[]>(() => assets.map(() => ""));
  useEffect(() => {
    setAmts(assets.map(() => ""));
    setZapAmt("");
  }, [pk, assets.length, openDep]);

  const bal = (i: number) => assetBalances[i] ?? 0;
  const setAmt = (i: number, v: string) => setAmts((cur) => cur.map((x, j) => (j === i ? v : x)));
  const priceOf = (i: number) => (live.amounts[i] > 0 ? live.valuesUsd[i] / live.amounts[i] : 0);

  const depUsd = assets.reduce((s, _, i) => s + (Number(amts[i]) || 0) * priceOf(i), 0);
  const grossShares = unitPrice > 0 ? depUsd / unitPrice : 0;
  const netShares = grossShares * (1 - b.feeBps / 10000);
  const anyAmt = amts.some((a) => (Number(a) || 0) > 0);
  const overBal = assets.some((_, i) => (Number(amts[i]) || 0) > bal(i) + 1e-9);

  // Withdraw preview: in-kind, pro-rata per asset by current weight.
  const wd = Number(wdAmt) || 0;
  const wdUsd = wd * unitPrice;
  const perAsset = assets.map((a, i) => ({ symbol: a.symbol, usd: wdUsd * ((live.weightsBps[i] ?? 0) / 10000) }));

  // zap preview: USDC split across underlying by target weight
  const zapSplit = assets.map((a, i) => ({
    symbol: a.symbol,
    usd: zapNum * (a.targetWeightBps / 10000),
    isQuote: i === qi,
  }));

  const submitDeposit = () => {
    onDepositAssets(amts.map((a) => Number(a) || 0));
    setOpenDep(false);
  };
  const submitZap = () => {
    onZap(zapNum);
    setOpenDep(false);
  };
  const submitWithdraw = () => {
    onWithdraw();
    setOpenWd(false);
  };

  return (
    <div className="trade">
      <div className="trade-card pos-card">
        <div className="pos-head">
          <span className="pos-label">Your position</span>
          <span className="pos-sym">{b.name || assets.map((a) => a.symbol).join(" / ")}</span>
        </div>
        <div className="pos-value">{connected ? usd(positionUsd) : "—"}</div>
        <div className="pos-sub">{connected ? `${num(userBalance)} fund tokens` : "Connect a wallet to invest"}</div>

        <button className="act pos-deposit" disabled={!connected} onClick={() => setOpenDep(true)}>
          <IconPlus width={15} height={15} /> Deposit
        </button>
        {connected && userBalance > 0 && (
          <button className="btn pos-withdraw" onClick={() => setOpenWd(true)}>
            <IconArrowDown width={14} height={14} /> Withdraw
          </button>
        )}
        {result && <ResultRow sig={result.sig} />}
      </div>

      {/* ---- deposit modal: multi-asset, in-kind ---- */}
      <Modal open={openDep} onClose={() => setOpenDep(false)}>
        <div className="trade-modal">
          <div className="cm-head tm-head">
            <div>
              <h2>Deposit</h2>
              <p>One token, swapped into the fund via Raydium — or add tokens manually.</p>
            </div>
            <button className="tm-refresh" type="button" onClick={onRefresh} aria-label="Refresh balances">
              <IconRefresh width={16} height={16} />
            </button>
          </div>

          <div className="segmented dep-modeswitch">
            <button type="button" className={"seg" + (mode === "zap" ? " on" : "")} onClick={() => setMode("zap")}>
              Zap from {quoteSym}
            </button>
            <button type="button" className={"seg" + (mode === "manual" ? " on" : "")} onClick={() => setMode("manual")}>
              Per token
            </button>
          </div>

          {mode === "zap" ? (
            <div className="cm-body">
              <div className="th">
                <span className="t">Deposit {quoteSym}</span>
                {connected && (
                  <button type="button" className="bal bal-btn" onClick={() => setZapAmt(String(quoteBal))}>
                    balance {num(quoteBal, 2)} {quoteSym}
                  </button>
                )}
              </div>
              <div className={"field" + (zapOver ? " field-err" : "")}>
                <input value={zapAmt} onChange={(e) => setZapAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
                <button className="maxbtn" type="button" onClick={() => setZapAmt(String(quoteBal))}>
                  MAX
                </button>
              </div>
              <div className="dep-split">
                <div className="dep-split-head">Swapped via Raydium → {assets.length} underlying tokens</div>
                {zapSplit.map((s, i) => (
                  <div className="dsplit-row" key={s.symbol} style={{ "--i": i } as CSSProperties}>
                    <span className="dsplit-id">
                      <TokenLogo symbol={s.symbol} index={i} size={18} /> {s.symbol}
                    </span>
                    <span className="dsplit-bar" aria-hidden>
                      <span style={{ width: `${assets[i]!.targetWeightBps / 100}%`, background: assetColor(s.symbol, i) }} />
                    </span>
                    <span className="dsplit-val">
                      {zapNum > 0 ? usd(s.usd) : `${(assets[i]!.targetWeightBps / 100).toFixed(0)}%`}
                      {s.isQuote ? " · kept" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="cm-body dep-rows">
              {assets.map((a, i) => (
                <div className="dep-row" key={a.symbol}>
                  <span className="dep-step">{i + 1}</span>
                  <div className="dep-row-main">
                    <div className="dep-row-head">
                      <span className="dep-token">
                        <TokenLogo symbol={a.symbol} index={i} size={24} /> {a.symbol}
                      </span>
                      <span className="dep-row-bal">
                        <button type="button" className="halfbtn" onClick={() => setAmt(i, String(bal(i) / 2))}>
                          HALF
                        </button>
                        <button type="button" className="dep-max" onClick={() => setAmt(i, String(bal(i)))}>
                          Max {num(bal(i), 4)}
                        </button>
                      </span>
                    </div>
                    <div className={"field" + ((Number(amts[i]) || 0) > bal(i) + 1e-9 ? " field-err" : "")}>
                      <input value={amts[i]} onChange={(e) => setAmt(i, e.target.value)} inputMode="decimal" placeholder="0.00" />
                      <span className="unit">{a.symbol}</span>
                    </div>
                  </div>
                </div>
              ))}
              {anyAmt && depUsd > 0 && (
                <div className="preview tm-preview">
                  <div className="prow">
                    <span>You deposit ≈ {usd(depUsd)}</span>
                    <span className="pv">≈ {num(netShares)} tokens</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="tm-note">
            <Info k="deployCost" /> {mode === "zap" ? "Swaps run on Raydium, then an in-kind deposit." : "A small, refundable rent (~0.002 SOL) may apply for new token accounts."}
          </div>

          <div className="cm-foot tm-foot">
            {mode === "zap" ? (
              <button className="act cm-create" disabled={busy !== null || zapNum <= 0 || zapOver} onClick={submitZap}>
                {busy === "deposit" ? (
                  <>
                    <span className="spinner" /> Swapping & depositing…
                  </>
                ) : zapOver ? (
                  `Not enough ${quoteSym}`
                ) : (
                  `Deposit ${quoteSym}`
                )}
              </button>
            ) : (
              <button className="act cm-create" disabled={busy !== null || !anyAmt || overBal} onClick={submitDeposit}>
                {busy === "deposit" ? (
                  <>
                    <span className="spinner" /> Depositing…
                  </>
                ) : overBal ? (
                  "Not enough balance"
                ) : (
                  "Deposit"
                )}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ---- withdraw modal: in-kind ---- */}
      <Modal open={openWd} onClose={() => setOpenWd(false)}>
        <div className="trade-modal trade-modal-sm">
          <div className="cm-head">
            <h2>
              Withdraw <Info k="inKind" />
            </h2>
            <p>Redeem your fund tokens for a pro-rata share of every asset.</p>
          </div>
          <div className="cm-body">
            <div className="th">
              <span className="t">Amount</span>
              <button type="button" className="bal bal-btn" onClick={() => setWdAmt(String(userBalance))}>
                balance {num(userBalance)}
              </button>
            </div>
            <div className="field">
              <input value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} inputMode="decimal" placeholder="0.00" />
              <button className="maxbtn" onClick={() => setWdAmt(String(userBalance))} type="button">
                MAX
              </button>
            </div>
            {wd > 0 && (
              <div className="preview">
                <div className="prow">
                  <span>You receive (share of each asset)</span>
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
          </div>
          <div className="cm-foot tm-foot">
            <button
              className="act cm-create"
              disabled={busy !== null || wd <= 0 || wd > userBalance + 1e-9}
              onClick={submitWithdraw}
            >
              {busy === "withdraw" ? (
                <>
                  <span className="spinner" /> Withdrawing…
                </>
              ) : (
                "Withdraw"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
